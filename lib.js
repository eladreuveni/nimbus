// function shareSheet() {
//   const sheetId = ss.getId();
  
//   // Assuming the emails are in column A starting from row 1
//   var emailSheet = ss.getSheetByName("try");
//   const emails = emailSheet.getRange(2, 2, emailSheet.getLastRow()-1, 1).getValues().flat();
  
//   const permissions = DriveApp.getFileById(sheetId).getSharingAccess();
  
//   if (permissions == DriveApp.Access.ANYONE_WITH_LINK) {
//     DriveApp.getFileById(sheetId).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.EDIT);
//   }

//   emails.forEach(function(email) {
//     try {
//       DriveApp.getFileById(sheetId).addViewer(email);
//       Logger.log('Shared with: ' + email);
//     } catch (e) {
//       Logger.log('Error sharing with ' + email + ': ' + e.toString());
//     }
//   });
  
//   Logger.log('Sharing completed');
// }

function getColIndexByTitle(sheet, title) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(title); // in case you want to access the col in the sheet and not just with array- add 1.
}

function getSheetColIndexes(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const indexes = {}
  headers.forEach(h => { indexes[h] = headers.indexOf(h) })
  return indexes
}

function headersArrToIndexesObj(headers) {
  const indexes = {}
  headers.forEach(h => { indexes[h] = headers.indexOf(h) })
  return indexes
}

function getCloudRoles() {
  const allRoles = cloud_roles.getRange(1, 1, cloud_roles.getLastRow(), cloud_roles.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allRoles.shift());
  const roles = [];

  allRoles.forEach((row)=> {
    const trainingPathID = row[cols['Training_Path_ID']];

    roles.push({
      id: row[cols['Role_ID']],
      name: row[cols['Role_Name']],
      trainingPath: row[cols['Training_Path']],
      trainingPathID: trainingPathID,
      desc: row[cols['Role_Description']],
    });
  })
  return roles;
}
function getCloudTrainings(allRoles) {
  // Iterate over the data and add trainingPathIDs to the set
  const trainingPathIDSet = new Set();
  allRoles.forEach(role => { trainingPathIDSet.add(role.trainingPathID) });

  const allTrainings = cloud_trainings.getRange(1, 1, cloud_trainings.getLastRow(), cloud_trainings.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allTrainings.shift());
  const trainingsByPathID = {};

  allTrainings.forEach((row)=> {
    const trainingPathID = row[cols['Training_Path_ID']];
    if (trainingPathIDSet.has(trainingPathID)) {
      const trainingObj = {
        id: row[cols['Training_ID']],
        pathID: trainingPathID,
        path: row[cols['Training_Path']],
        name: row[cols['Training_Name']],
        cloudVendor: row[cols['Cloud_Vendor']], // aws, gcp
        managmentJourney: row[cols['Training_Management_Journey']],
      }
      if (!trainingsByPathID[trainingPathID]) {trainingsByPathID[trainingPathID] = []}
      trainingsByPathID[trainingPathID].push(trainingObj);
    }
  })
  return trainingsByPathID;
}
function getDepRolesData(depID) {
  const allDataRoles = data_roles.getRange(1, 1, data_roles.getLastRow(), data_roles.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allDataRoles.shift());
  const dataRolesByRoleID = {};

  allDataRoles.forEach((row) => {
    if (row[cols['Dep_ID']] == depID) {
      const roleID = row[cols['Role_ID']];
      const dataObj = {};
      for (const [qName, qIndex] of Object.entries(cols)) {
        if (qName.startsWith('Training_Roles')) {
          dataObj[qName] = row[qIndex];
        }
      }
      dataRolesByRoleID[roleID] = (dataObj);
    }
  })
  return dataRolesByRoleID;
}
/**
 * Most complex func.
 * result will look like this:
 * {
 *    [Training_Role_ID]: {
 *        [Training_ID]: {
 *            [Training_(number)]: Answer to that question 
 *        }
 *    }
 * }
 */
function getSpecificTrainingData(depID) {
  const allDataTrainings = data_trainings.getRange(1, 1, data_trainings.getLastRow(), data_trainings.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allDataTrainings.shift());
  
  const myDataTrainings = {};

  // test if value question
  const regex = /^Training_\d+$/;

  allDataTrainings.forEach((row) => {
    if (row[cols['Dep_ID']] == depID) {
      const trainingRoleID = row[cols['Training_Role_ID']];
      const trainingID = row[cols['Training_ID']];
      const dataObj = {};
      for (const [qName, qIndex] of Object.entries(cols)) {
        if (regex.test(qName)) {
          dataObj[qName] = row[qIndex];
        }
      }
      if (!myDataTrainings[trainingRoleID]) { myDataTrainings[trainingRoleID] = {} }
      myDataTrainings[trainingRoleID][trainingID] = dataObj;
    }
  })
  return myDataTrainings;
}
/**
 * Here I compose the Babushka for page5's complex section
 */
function getAllRolesAndTrainings(depID = 8) {
  // survey general data
  const allRoles = getCloudRoles();
  const allTrainings = getCloudTrainings(allRoles);

  // dep data
  const depRolesData = getDepRolesData(depID);
  const depTrainingData = getSpecificTrainingData(depID);

  return { allRoles, allTrainings, depRolesData, depTrainingData }
}












