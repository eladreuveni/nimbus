function shareSheet() {
  const sheetId = ss.getId();
  
  // Assuming the emails are in column A starting from row 1
  var emailSheet = ss.getSheetByName("Users");
  const emails = emailSheet.getRange(11, 2, emailSheet.getLastRow()-10, 1).getValues().flat();
  
  const permissions = DriveApp.getFileById(sheetId).getSharingAccess();
  
  if (permissions == DriveApp.Access.ANYONE_WITH_LINK) {
    DriveApp.getFileById(sheetId).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.EDIT);
  }

  emails.forEach(function(email) {
    try {
      DriveApp.getFileById(sheetId).addEditor(email);
      Logger.log('Shared with: ' + email);
    } catch (e) {
      Logger.log('Error sharing with ' + email + ': ' + e.toString());
    }
  });
  
  Logger.log('Sharing completed');
}