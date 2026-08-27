# Trigger patch workflow
from pathlib import Path

index = Path('index.html')
html = index.read_text(encoding='utf-8')
old_html = '''        <div id="adminInvitePanel" class="admin-invite-panel">
          <label>Employee Email<input id="adminInviteEmail" type="email" placeholder="employee@company.com" autocomplete="off" /></label>
          <button id="adminInviteUserBtn" class="btn btn-primary" type="button">Send Invite</button>
        </div>
        <div id="adminUsersList" class="admin-users-list"></div>'''
new_html = '''        <div id="adminCreateUserPanel" class="admin-invite-panel">
          <label>Employee Email<input id="adminCreateEmail" type="email" placeholder="employee@company.com" autocomplete="off" /></label>
          <label>Temporary Password<input id="adminCreatePassword" type="text" minlength="12" placeholder="Minimum 12 characters" autocomplete="off" /></label>
          <button id="adminGeneratePasswordBtn" class="btn btn-secondary" type="button">Generate Password</button>
          <button id="adminCreateUserBtn" class="btn btn-primary" type="button">Create User</button>
        </div>
        <p class="admin-note">Create User activates the Employee immediately without sending email. The employee must change the temporary password at first sign-in.</p>
        <div id="adminInvitePanel" class="admin-invite-panel">
          <label>Email Invite (optional)<input id="adminInviteEmail" type="email" placeholder="employee@company.com" autocomplete="off" /></label>
          <button id="adminInviteUserBtn" class="btn btn-secondary" type="button">Send Email Invite</button>
        </div>
        <div id="adminUsersList" class="admin-users-list"></div>'''
if html.count(old_html) != 1:
    raise SystemExit('Admin invite panel markup did not match expected source.')
index.write_text(html.replace(old_html, new_html), encoding='utf-8')

app = Path('app.js')
js = app.read_text(encoding='utf-8')
old_open = 'function openAdminDialog(){if(!isAdmin())return toast("Admin access required.");if(state.currentProjectId)saveEditorProject();renderAdminDisclaimers();renderAdminUsers();populateOfficeSettings();$("#adminInvitePanel")?.classList.toggle("hidden",!authBackendConfigured);if($("#adminUsersNote"))$("#adminUsersNote").textContent=authBackendConfigured?"New invited users are Employees by default. Admins can promote another user to Admin. Password reset links are sent to the user’s email; temporary passwords require a password change at next sign-in.":"Secure Supabase login is unavailable in this browser session.";$("#adminDialog").showModal();}'
new_open = 'function openAdminDialog(){if(!isAdmin())return toast("Admin access required.");if(state.currentProjectId)saveEditorProject();renderAdminDisclaimers();renderAdminUsers();populateOfficeSettings();$("#adminInvitePanel")?.classList.toggle("hidden",!authBackendConfigured);$("#adminCreateUserPanel")?.classList.toggle("hidden",!authBackendConfigured);if($("#adminUsersNote"))$("#adminUsersNote").textContent=authBackendConfigured?"Admins can create active Employee accounts with a temporary password or use email invitations. Temporary-password users must choose a new password at first sign-in. Admins can promote another user to Admin, send password resets, or remove users while preserving company project history.":"Secure Supabase login is unavailable in this browser session.";$("#adminDialog").showModal();}'
if js.count(old_open) != 1:
    raise SystemExit('openAdminDialog source did not match expected text.')
js = js.replace(old_open, new_open)

marker = '''async function inviteRemoteUser(){
  if(!authBackendConfigured)return toast("Secure backend is not configured.");'''
insert = '''async function createRemoteUserWithTempPassword(){
  if(!authBackendConfigured)return toast("Secure backend is not configured.");
  const email=$("#adminCreateEmail")?.value.trim().toLowerCase()||"";
  const password=$("#adminCreatePassword")?.value||"";
  if(!email||!email.includes("@"))return toast("Enter a valid employee email.");
  if(password.length<12)return toast("Temporary password must be at least 12 characters.");
  const btn=$("#adminCreateUserBtn");if(btn)btn.disabled=true;
  try{
    await supabaseFunctionFetch('scope-admin-create-user',{method:'POST',body:JSON.stringify({email,password})});
    $("#adminCreateEmail").value="";$("#adminCreatePassword").value="";
    await renderAdminUsers();
    toast(`Employee account created for ${email}.`);
  }catch(err){console.error(err);toast(err.message||"Could not create employee account.");}
  finally{if(btn)btn.disabled=false;}
}
function generateAdminTemporaryPassword(){
  const input=$("#adminCreatePassword");if(!input)return;
  input.value=generateTemporaryPassword();input.focus();input.select();
  toast("Temporary password generated. Copy it before creating the user.");
}

'''
if js.count(marker) != 1:
    raise SystemExit('inviteRemoteUser marker not found exactly once.')
js = js.replace(marker, insert + marker)

old_wire = '$("#adminDownloadBackupBtn").addEventListener("click",downloadDataBackup);$("#adminRestoreBackupBtn").addEventListener("click",triggerRestoreBackup);$("#adminInviteUserBtn")?.addEventListener("click",inviteRemoteUser);'
new_wire = '$("#adminDownloadBackupBtn").addEventListener("click",downloadDataBackup);$("#adminRestoreBackupBtn").addEventListener("click",triggerRestoreBackup);$("#adminCreateUserBtn")?.addEventListener("click",createRemoteUserWithTempPassword);$("#adminGeneratePasswordBtn")?.addEventListener("click",generateAdminTemporaryPassword);$("#adminInviteUserBtn")?.addEventListener("click",inviteRemoteUser);'
if js.count(old_wire) != 1:
    raise SystemExit('Admin event wiring source did not match expected text.')
js = js.replace(old_wire, new_wire)
app.write_text(js, encoding='utf-8')
