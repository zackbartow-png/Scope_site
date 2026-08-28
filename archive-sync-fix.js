(() => {
  // Archive/import cloud-sync stability patch.
  // The projects table has a database trigger that updates row.updated_at on every
  // UPDATE. That server timestamp is not the proposal edit timestamp, so using it
  // to choose between local and cloud copies can make an older cloud copy win after
  // an archive/import. Use project_data.updatedAt as the authoritative edit time.

  if (typeof normalizeProject !== 'function' || typeof ownerKey !== 'function') {
    console.warn('Archive sync fix skipped: Scope Builder core is unavailable.');
    return;
  }

  const projectEditTime = project => {
    const value = project?.updatedAt || project?.createdAt || '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const projectCompletenessScore = project => {
    if (!project) return 0;
    let score = 0;
    const nonEmpty = value => Boolean(String(value || '').trim());

    if (nonEmpty(project.projectName)) score += 1;
    if (nonEmpty(project.clientName)) score += 1;
    if (nonEmpty(project.projectAddress)) score += 1;
    if (nonEmpty(project.introNote)) score += 2;
    if (nonEmpty(project.clarifications)) score += 2;
    if (nonEmpty(project.exclusions)) score += 2;

    Object.values(project.divisions || {}).forEach(division => {
      const text = String(division?.text || '').trim();
      const rich = String(division?.richText || '').replace(/<[^>]*>/g, '').trim();
      if (division?.enabled && (text || rich)) score += 10;
      else if (text || rich) score += 3;
    });

    (project.alternateScopes || []).forEach(alternate => {
      const text = String(alternate?.text || '').trim();
      const rich = String(alternate?.richText || '').replace(/<[^>]*>/g, '').trim();
      if (text || rich) score += 8;
    });

    (project.priceItems || []).forEach(item => {
      if (nonEmpty(item?.name) || nonEmpty(item?.price) || nonEmpty(item?.description)) score += 5;
    });

    if ((project.kickoff?.divisions || []).length) score += 2;
    if ((project.kickoff?.quotes || []).length) score += 2;
    return score;
  };

  mergeCloudAndLocalProjects = function(localProjects, cloudRows, ownerUsername) {
    const map = new Map();
    (localProjects || []).forEach(raw => {
      const project = normalizeProject(raw, ownerUsername);
      map.set(project.id, project);
    });

    (cloudRows || []).forEach(row => {
      if (!row?.project_data) return;
      const cloud = normalizeProject({ ...row.project_data, ownerUsername }, ownerUsername);
      const local = map.get(cloud.id);
      if (!local) {
        map.set(cloud.id, cloud);
        return;
      }

      const localTime = projectEditTime(local);
      // project_data.updatedAt is the actual proposal edit timestamp. row.updated_at
      // is only a fallback for legacy rows that do not contain an internal timestamp.
      const cloudTime = projectEditTime(cloud) || (Date.parse(row.updated_at || '') || 0);
      const cloudIsNewer = cloudTime > localTime;
      const sameTimeButMoreComplete = cloudTime === localTime && projectCompletenessScore(cloud) > projectCompletenessScore(local);
      if (cloudIsNewer || sameTimeButMoreComplete) map.set(cloud.id, cloud);
    });

    return [...map.values()].sort((a, b) => projectEditTime(b) - projectEditTime(a));
  };
  window.mergeCloudAndLocalProjects = mergeCloudAndLocalProjects;

  // Only write projects that are actually newer than the cloud copy. This prevents
  // dashboard refreshes from touching every database row and making stale cloud data
  // appear newer solely because the database updated_at trigger ran.
  syncProjectsToCloudNow = async function(username, projects) {
    if (!authBackendConfigured || !authClient || !state.user || !username) return;
    const ownerId = await resolveCloudOwnerId(username);
    if (!ownerId) throw new Error(`Could not resolve the cloud owner for ${username}.`);

    const list = (projects || []).map(project => normalizeProject(project, username));
    if (!list.length) return;

    const { data: existingRows, error: readError } = await authClient
      .from('projects')
      .select('id,project_data')
      .eq('owner_id', ownerId);
    if (readError) throw readError;

    const existingById = new Map((existingRows || []).map(row => [row.id, row]));
    const rowsToWrite = [];

    list.forEach(project => {
      const existing = existingById.get(project.id);
      if (!existing?.project_data) {
        rowsToWrite.push(cloudProjectRow(project, ownerId, username));
        return;
      }

      const cloud = normalizeProject({ ...existing.project_data, ownerUsername: username }, username);
      const localTime = projectEditTime(project);
      const cloudTime = projectEditTime(cloud);
      const localIsNewer = localTime > cloudTime;
      const sameTimeButMoreComplete = localTime === cloudTime && projectCompletenessScore(project) > projectCompletenessScore(cloud);
      if (localIsNewer || sameTimeButMoreComplete) rowsToWrite.push(cloudProjectRow(project, ownerId, username));
    });

    if (!rowsToWrite.length) return;
    const { error } = await authClient.from('projects').upsert(rowsToWrite, { onConflict: 'id' });
    if (error) throw error;
  };
  window.syncProjectsToCloudNow = syncProjectsToCloudNow;

  async function cloudFamilyRows(ownerUsername, familyId) {
    if (!authBackendConfigured || !authClient || !state.user) return [];
    const ownerId = await resolveCloudOwnerId(ownerUsername);
    if (!ownerId) return [];
    const { data, error } = await authClient
      .from('projects')
      .select('id,family_id,owner_id,project_data,updated_at')
      .eq('owner_id', ownerId)
      .eq('family_id', familyId);
    if (error) throw error;
    return data || [];
  }

  async function verifyCloudImport(ownerUsername, familyId, expectedProjects) {
    if (!authBackendConfigured || !authClient || !state.user) return;
    const rows = await cloudFamilyRows(ownerUsername, familyId);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const expected of expectedProjects) {
      const row = byId.get(expected.id);
      if (!row?.project_data) throw new Error(`Cloud restore verification failed for ${expected.projectName || 'project'}.`);
      const cloud = normalizeProject({ ...row.project_data, ownerUsername }, ownerUsername);
      const expectedTime = projectEditTime(expected);
      const cloudTime = projectEditTime(cloud);
      if (cloudTime < expectedTime || projectCompletenessScore(cloud) < projectCompletenessScore(expected)) {
        throw new Error(`Cloud restore verification found an incomplete copy of ${expected.projectName || 'project'}.`);
      }
    }
  }

  importKoehnProjectArchive = async function(file) {
    if (!file) return;
    try {
      const payload = await readKoehnArchiveFile(file);
      const originalOwner = String(payload.ownerUsername || '');
      let targetOwner = state.user.username;
      if (isAdmin() && originalOwner && getUserRecord(originalOwner)) targetOwner = originalOwner;

      // Treat the imported archive as the authoritative current copy. Giving every
      // restored version a fresh edit timestamp prevents an older cloud row from
      // replacing the restored scope, alternates, or pricing on the next refresh.
      const restoredAt = nowIso();
      const incoming = payload.projects.map(raw => normalizeProject({
        ...raw,
        ownerUsername: targetOwner,
        archived: false,
        updatedAt: restoredAt
      }, targetOwner));

      const familyId = incoming[0]?.familyId || incoming[0]?.id;
      if (!familyId) throw new Error('Archive has no project family ID.');

      let existing = getProjectsForUser(targetOwner, { includeDeleted: true });
      const collision = existing.some(project => (project.familyId || project.id) === familyId);
      if (collision && !confirm('This project already exists in the workspace. Replace the existing copy with the archived copy?')) return;
      if (collision) {
        existing = existing.filter(project => (project.familyId || project.id) !== familyId);
        await deleteFamilyQuoteAssets(familyId);
      }

      (payload.termsAndConditions || []).forEach(term => {
        if (term?.id && !getDisclaimers().some(disclaimer => disclaimer.id === term.id)) {
          const allTerms = getDisclaimers();
          allTerms.push(term);
          saveDisclaimers(allTerms);
        }
      });

      const nextProjects = [...incoming, ...existing];
      saveProjectsForUser(targetOwner, nextProjects);

      // Do not leave restoration to the normal debounce. Persist the complete project
      // family first so employee accounts immediately have the same cloud copy Admin sees.
      const syncKey = ownerKey(targetOwner);
      clearTimeout(cloudProjectSyncTimers.get(syncKey));
      cloudProjectSyncTimers.delete(syncKey);
      if (authBackendConfigured && authClient) {
        await syncProjectsToCloudNow(targetOwner, nextProjects);
        await verifyCloudImport(targetOwner, familyId, incoming);
      }

      for (const asset of payload.assets || []) {
        if (!asset?.key || !asset?.data) continue;
        await putQuoteAsset({
          key: asset.key,
          familyId: asset.familyId || familyId,
          quoteId: asset.quoteId,
          divisionId: asset.divisionId,
          assetType: asset.assetType,
          pageIndex: asset.pageIndex,
          name: asset.name,
          mime: asset.mime || 'image/webp',
          blob: base64ToBlob(asset.data, asset.mime || 'image/webp'),
          width: asset.width,
          height: asset.height,
          createdAt: asset.createdAt || nowIso()
        });
      }

      state.dashboardMode = 'active';
      refreshDashboardNav();
      renderProjects();
      toast(`Imported ${payload.projectName || 'project'} with full scope and pricing restored.`);
    } catch (error) {
      console.error('Project archive import failed.', error);
      toast(error?.message || 'Could not import that .koehn archive.');
    }
  };
  window.importKoehnProjectArchive = importKoehnProjectArchive;

  archiveFamilyToKoehn = async function(familyId, ownerUsername) {
    if (ownerKey(ownerUsername) !== ownerKey(state.user.username) && !isAdmin()) {
      return toast('You can only archive your own projects.');
    }

    let all = getProjectsForUser(ownerUsername, { includeDeleted: true });
    let family = all.filter(project => (project.familyId || project.id) === familyId);
    if (!family.length) return toast('Project not found.');

    // Before packaging, merge in any newer cloud copy using the proposal's own
    // updatedAt value. This ensures the archive contains the most complete scope.
    try {
      const rows = await cloudFamilyRows(ownerUsername, familyId);
      if (rows.length) {
        family = mergeCloudAndLocalProjects(family, rows, ownerUsername);
        const familyIds = new Set(family.map(project => project.id));
        all = [
          ...family,
          ...all.filter(project => !familyIds.has(project.id) && (project.familyId || project.id) !== familyId)
        ];
      }
    } catch (error) {
      console.warn('Could not refresh the project family from cloud before archiving.', error);
    }

    const latest = [...family].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
    const ok = confirm(`Archive ${latest.projectName || 'this project'}?\n\nA .koehn archive file will download, then this project and its kickoff assets will be removed from the active workspace. Import the .koehn file later to restore it.`);
    if (!ok) return;

    const menuBtn = $(`[data-archive-family="${CSS.escape(familyId)}"]`);
    if (menuBtn) menuBtn.disabled = true;

    try {
      const allAssets = await getFamilyQuoteAssets(familyId);
      const referencedKeys = new Set();
      (latest.kickoff?.quotes || []).forEach(quote => (quote.pages || []).forEach(key => referencedKeys.add(key)));
      (latest.kickoff?.divisions || []).forEach(division => kickoffImageKeysFromHtml(division.notesHtml || '').forEach(key => referencedKeys.add(key)));
      const assets = allAssets.filter(asset => referencedKeys.has(asset.key));
      const packedAssets = [];

      for (const asset of assets) {
        packedAssets.push({
          key: asset.key,
          familyId: asset.familyId,
          quoteId: asset.quoteId,
          divisionId: asset.divisionId,
          assetType: asset.assetType,
          pageIndex: asset.pageIndex,
          name: asset.name,
          mime: asset.mime,
          width: asset.width,
          height: asset.height,
          createdAt: asset.createdAt,
          data: await blobToBase64(asset.blob)
        });
      }

      const terms = [...new Set(family.map(project => project.disclaimerId).filter(Boolean))]
        .map(id => getDisclaimer(id))
        .filter(Boolean);
      const payload = {
        schema: 'koehn-project-archive',
        version: 2,
        createdAt: nowIso(),
        ownerUsername,
        projectName: latest.projectName || 'Project',
        familyId,
        projects: family,
        termsAndConditions: terms,
        assets: packedAssets,
        assetPolicy: {
          sourcePdfsRetained: false,
          quoteStorage: 'compressed-page-snapshots',
          divisionImages: 'compressed-inline-images'
        }
      };

      const archiveBlob = await gzipJsonBlob(payload);
      const fileName = `${safeFilePart(latest.projectNumber || latest.projectName || 'Project')}_${safeFilePart(latest.projectName || 'Archive')}.koehn`;
      downloadBlob(archiveBlob, fileName);

      // Assets are safely inside the archive before anything is removed.
      await deleteFamilyQuoteAssets(familyId);
      if (authBackendConfigured && authClient) {
        await deleteCloudProjectFamily(ownerUsername, familyId);
        const remainingCloudRows = await cloudFamilyRows(ownerUsername, familyId);
        if (remainingCloudRows.length) throw new Error('The archive downloaded, but the cloud project could not be removed. The local project was kept for safety.');
      }

      const remainingProjects = all.filter(project => (project.familyId || project.id) !== familyId);
      saveProjectsForUser(ownerUsername, remainingProjects);
      const syncKey = ownerKey(ownerUsername);
      clearTimeout(cloudProjectSyncTimers.get(syncKey));
      cloudProjectSyncTimers.delete(syncKey);
      if (authBackendConfigured && authClient && remainingProjects.length) {
        await syncProjectsToCloudNow(ownerUsername, remainingProjects);
      }

      refreshDashboardNav();
      renderProjects();
      toast(`Archived to ${fileName}.`);
    } catch (error) {
      console.error('Project archive failed.', error);
      toast(error?.message || 'Could not create the project archive.');
    } finally {
      if (menuBtn) menuBtn.disabled = false;
    }
  };
  window.archiveFamilyToKoehn = archiveFamilyToKoehn;

  console.info('Scope Builder archive/import sync fix loaded.');
})();
