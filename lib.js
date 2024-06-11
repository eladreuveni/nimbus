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
  let depDataRoles = allDataRoles.filter(row => (row[cols['Dep_ID']] == depID))
  depDataRoles = keepLatestAnswers(depDataRoles, cols['Last_Updated'])
  const dataRolesByRoleID = {};

  depDataRoles.forEach((row) => {
    const roleID = row[cols['Role_ID']];
    const dataObj = {};
    for (const [qName, qIndex] of Object.entries(cols)) {
      if (qName.startsWith('Training_Roles')) {
        dataObj[qName] = row[qIndex];
      }
    }
    dataRolesByRoleID[roleID] = (dataObj);
  })
  return dataRolesByRoleID;
}
function getSpecificTrainingData(depID) {
  const allDataTrainings = data_trainings.getRange(1, 1, data_trainings.getLastRow(), data_trainings.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allDataTrainings.shift());
  let depDataTrainings = allDataTrainings.filter(row => (row[cols['Dep_ID']] == depID))
  depDataTrainings = keepLatestAnswers(depDataTrainings, cols['Last_Updated'])
  const myDataTrainings = {};

  // test if value question
  const regex = /^Training_\d+$/;

  depDataTrainings.forEach((row) => {
    const roleID = row[cols['Role_ID']];
    const trainingID = row[cols['Training_ID']];
    const dataObj = {};
    for (const [qName, qIndex] of Object.entries(cols)) {
      if (regex.test(qName)) {
        dataObj[qName] = row[qIndex];
      }
    }
    if (!myDataTrainings[roleID]) { myDataTrainings[roleID] = {} }
    myDataTrainings[roleID][trainingID] = dataObj;
  })
  return myDataTrainings;
}
/**
 * Here I compose the Babushka for page5's complex section
 */
function getAllRolesAndTrainings(depID) {
  // survey general data
  const allRoles = getCloudRoles();
  const allTrainings = getCloudTrainings(allRoles);

  // dep data
  const depRolesData = getDepRolesData(depID);
  const depTrainingData = getSpecificTrainingData(depID);

  return { allRoles, allTrainings, depRolesData, depTrainingData }
}

function trainingAnswersByPrefix(answers) {
    const trainings = {};
    const trainingGeneral = {};
    const trainingRoles = {};

    for (const key in answers) {
      if (key.startsWith("Training_General")) {
        trainingGeneral[key] = answers[key];
      } else if (key.startsWith("Training_Roles")) {
        trainingRoles[key] = answers[key];
      } else if (key.includes("Training_ID")) {
        trainings[key] = answers[key];
      }
    }
    return { trainings, trainingGeneral, trainingRoles };
}
function groupByRoleId(data) {
  const groupedData = {};

  for (const key in data) {
    const roleIdMatch = key.match(/Role_ID=(\d+)/);
    if (roleIdMatch) {
      const roleId = roleIdMatch[1];
      if (!groupedData[roleId]) {
        groupedData[roleId] = {};
      }
      groupedData[roleId][key.split(',')[0]] = data[key];
    }
  }

  return groupedData;
}

function saveTrainingRolesData(trainingRoles, depID, sheet, curr_time) {
  const currAnswers = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = currAnswers.shift();

  const cleaned = {};
  for (const key in trainingRoles) {
    if (trainingRoles[key] !== "") {
      cleaned[key] = trainingRoles[key];
    }
  }  
  const byRoleID = groupByRoleId(cleaned);
  const answers = [];

  for (const roleID in byRoleID) {
    const singleRole = []
    headers.forEach((ques) => {
      let ans = "";
      if (ques == 'Dep_ID') { ans = depID }
      else if (ques == 'Role_ID') { ans = roleID }
      else if (ques == "Last_Updated") { ans = curr_time }
      else { ans = byRoleID[roleID][ques] || "" }
      singleRole.push(ans);
    })
    answers.push(singleRole);
  }

  // Determine the starting row
  const startRow = sheet.getLastRow() + 1;
  const startCol = 1; // Assuming data starts at the first column
  
  // Get the range where the data will be inserted
  const range = sheet.getRange(startRow, startCol, answers.length, answers[0] ? answers[0].length : 0);
  
  // Set the values in the range
  range.setValues(answers);
}
function saveTrainingsData(trainings, depID, sheet, curr_time) {
  const currAnswers = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = currAnswers.shift();
  
  const answers = [];
  for (const t in trainings) { // currently because only one question
    if (trainings[t] == "") {
      continue;
    }
    const [ques_name, roleID, trainingID] = t.split(',');
    const singleTAns = []
    headers.forEach((ques) => {
      let ans = "";
      if (ques == 'Dep_ID') { ans = depID }
      else if (ques == 'Role_ID') { ans = roleID.split('=')[1] }
      else if (ques == 'Training_ID') { ans = trainingID.split('=')[1] }
      else if (ques == "Last_Updated") { ans = curr_time }
      else { ans = trainings[t] || "" }
      singleTAns.push(ans);
    })
    answers.push(singleTAns);
  }

  // Determine the starting row
  const startRow = sheet.getLastRow() + 1;
  const startCol = 1; // Assuming data starts at the first column
  
  // Get the range where the data will be inserted
  const range = sheet.getRange(startRow, startCol, answers.length, answers[0] ? answers[0].length : 0);
  
  // Set the values in the range
  range.setValues(answers);
}

// Latest Answers assume that all the last answers have the same last_updated
function keepLatestAnswers(data, last_updated_index, name_index) {
    // Find the most recent date
    let mostRecentDate = new Date(0); // Initialize with a very old date
    data.forEach(function(entry) {
        const entryDate = new Date(entry[last_updated_index]);
        if (entryDate > mostRecentDate) {
            mostRecentDate = entryDate;
        }
    });

    // Filter out items with dates other than the most recent date
    const filteredData = data.filter(function(entry) {
        if (name_index && !entry[name_index]) { return false } // ignore ones without ms name
        const entryDate = new Date(entry[last_updated_index]);
        return (entryDate.getTime() === mostRecentDate.getTime());
    });
    return filteredData;
}