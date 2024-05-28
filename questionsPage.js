const ss = SpreadsheetApp.getActiveSpreadsheet()
const users_sheet = ss.getSheetByName("Users");
const department_sheet = ss.getSheetByName("Department");

const questions_page = ss.getSheetByName("Questions_Projects");
const projects = ss.getSheetByName("Projects");
const projects_type = ss.getSheetByName("Projects_Type");
const answers_sheet = ss.getSheetByName("Answers");
const mile_stones = ss.getSheetByName("Mile_Stones");

const cloud_roles = ss.getSheetByName("Cloud_Roles");
const cloud_trainings = ss.getSheetByName("Cloud_Trainings");

const data_mile_stones = ss.getSheetByName("Data_Mile_Stones");
const data_projects = ss.getSheetByName("Data_Projects");
const data_barriers = ss.getSheetByName("Data_Barriers");
const data_readiness = ss.getSheetByName("Data_Readiness");
const data_pages = ss.getSheetByName("Data_Pages");
const data_trainings_general = ss.getSheetByName("Data_Trainings_General");
const data_roles = ss.getSheetByName("Data_Roles");
const data_trainings = ss.getSheetByName("Data_Trainings");

let pageNumberToPrefix;
let pagePrefixToNumber;

function pagesInfo() {
  const pagesData = data_pages.getRange(1, 1, data_pages.getLastRow(), data_pages.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(pagesData.shift());

  const numToPrefix = {}
  const prefixToNum = {}
  pagesData.forEach((page)=> {
    const pNum = page[cols['Page_Number']];
    const pPrefix = page[cols['Page_Ques_Prefix']];

    numToPrefix[pNum] = pPrefix;
    prefixToNum[pPrefix] = pNum;
  })
  pageNumberToPrefix = numToPrefix;
  pagePrefixToNumber = prefixToNum;
}
pagesInfo();

const pagePrefixToDataSheet = {
  'DT': data_projects,
  'Readiness': data_readiness,
  'Barrier': data_barriers,
  'Training': data_trainings_general,
}

function doGet() {
   return HtmlService.createTemplateFromFile('loginPage').evaluate()
    .setTitle('Survey')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // not sure about this line
}

function goToHomePage(page) {
  return HtmlService.createHtmlOutputFromFile(page).getContent()
  // i want to change it to HtmlService.createTemplateFromFile('loginPage').evaluate() and then use include for the css. but ot doesnt work:)
}
function confirmEmailGenerateToken(email) {
  const token = authenticate(email.toLowerCase());
  if (token) { return token }
  return false
}
function checkLoginByToken(token) {
  const userFound = authenticateByToken(token);
  return userFound
}
function checkLoginByAllowedEmail() {
  const email = Session.getEffectiveUser().getEmail();
  if (email) {
    const res = confirmEmailGenerateToken(email)
    return res
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function generateRandomToken(length = 5) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function authenticate(email){
  const users_sheet_cols = getSheetColIndexes(users_sheet)

  const users_data = users_sheet.getRange(2, 1, users_sheet.getLastRow()-1 ,users_sheet.getLastColumn()).getValues();
  const userRowIndex = users_data.findIndex(user_data => user_data[users_sheet_cols['User_Mail']].toLowerCase() == email);
  if (userRowIndex === -1){ //think what you want to do here
    // user not found
    return false
  }
  // all good
  const randomToken = generateRandomToken(5);
  const token_cell = users_sheet.getRange(userRowIndex + 2, users_sheet_cols['Session_Token'] + 1);
  token_cell.setValue(randomToken);
  return randomToken;
}
function authenticateByToken(token){
  const users_sheet_cols = getSheetColIndexes(users_sheet);

  const users_data = users_sheet.getRange(2, 1, users_sheet.getLastRow()-1 ,users_sheet.getLastColumn()).getValues();
  const userRowIndex = users_data.findIndex(user_data => user_data[users_sheet_cols['Session_Token']] == token);
  if (userRowIndex === -1){ //think what you want to do here
    // user not found
    return false
  }
  // all good
  return true
}


function getAllowedEmails() {
  const users_sheet_cols = getSheetColIndexes(users_sheet);
  const numRows = users_sheet.getLastRow() - 1; // exclude the first row
  const user_emails = users_sheet.getRange(2, users_sheet_cols['User_Mail'] + 1, numRows).getValues().flat();
  return user_emails.filter(Boolean);
}

function getCurrDateTime(){
    let currentDate = new Date();
    let options = {
        timeZone: 'Asia/Jerusalem', // Set the time zone to Israel
        hour12: false, // Use 24-hour format
        weekday: 'long', // Display the full weekday name
        year: 'numeric', // Display the year
        month: 'numeric', // Display the month
        day: 'numeric', // Display the day
        hour: '2-digit', // Display hours with leading zeros
        minute: '2-digit', // Display minutes with leading zeros
        second: '2-digit' // Display seconds with leading zeros
    };
    let israelTime = currentDate.toLocaleString('en-US', options);
    return israelTime;
}

//create questions of survey
function getQuestionsForUser(user_dep_id, user_proj_id, page_num) {
  const allQ = questions_page.getRange(1, 1, questions_page.getLastRow(), questions_page.getLastColumn()).getValues();
  const headers = allQ.shift()
  const cols = headersArrToIndexesObj(headers)
  const is_funded = isProjFunded(user_proj_id);

  const pageQ = allQ.filter(q => {
    const onPage = q[cols['Ques_Name']].startsWith(pageNumberToPrefix[page_num])
    if (!onPage) { return false }

    const projectFundStatus = q[cols['Ques_Project_Type']]; //all/funded/not_funded
    if ((is_funded && projectFundStatus == 'Not_Funded') | ((!is_funded && projectFundStatus == 'Funded'))) { return false }

    return true;
  })
  const questions = [];

  const pageAnswers = getPrevAns(user_dep_id, user_proj_id, page_num); 

  pageQ.forEach((ques)=> {
    const ques_name_en = ques[cols['Ques_Name']];//ques name in en
    const type = ques[cols['Ques_Type']]; //ques type
    const options = getOptionsForQuestion(ques_name_en);
    let answer = pageAnswers[ques_name_en]; 
    if (type == 'Date' && answer){
      answer = answer.toString();
    }
    questions.push({
      ques_name:ques_name_en,
      question: ques[cols['Ques_Name_Heb']],//ques in hebrew,
      type: type,
      options: options,
      max_choice: ques[cols['Ques_Max_Choice']], //ques maxChoice,
      answer: answer,
      ques_number: ques[cols['Ques_no']], //ques number,
      info: ques[cols['Ques_Description']], //ques info,
      title: ques[cols['Ques_Group_Title']], //ques title,
      subTitle: ques[cols['Ques_Group_Name']], //ques subTitle,
      ans_next_to_ques: ques[cols['Ans_Next_To_Ques']], //ques is inTable,
      required: ques[cols['Ques_Required_Ind']], //is ques required
      position: ques[cols['Ques_Page_Position']], // position in page (5)
    });
  })
  return questions;
}

function getMyRolesAndTrainings(depID) {
  try {
    return getAllRolesAndTrainings(depID)
  }
  catch (e) {
    console.error(e)
    return false;
  }
}

function isProjFunded(user_proj_id){
  const projects_sheet_cols = getSheetColIndexes(projects)

  let projects_data = projects.getRange(2, 1, projects.getLastRow(),projects.getLastColumn() - 1).getValues();
  let project_info = projects_data.find((proj) => proj[projects_sheet_cols['Project_ID']] == user_proj_id);
  let is_funded = project_info[projects_sheet_cols['Project_Funded_Ind']];
  return (is_funded == 'Funded')
}

function getOptionsForQuestion(ques_name){
  const answers_sheet_cols = getSheetColIndexes(answers_sheet);
  
  const excel_col = answers_sheet_cols[ques_name] + 1;
  if (excel_col) {
    const ques_options = answers_sheet.getRange(2, excel_col, answers_sheet.getLastRow(), 1).getValues().flat();
    return ques_options.filter(Boolean);
  }
  return '';
}

function getMilesStones(user_proj_id){
  const mile_stones_sheet_cols = getSheetColIndexes(mile_stones)

  const proj_type_id = getProjectTypeId(user_proj_id);
  const miles_prev_ans = getMilesStonesData(user_proj_id);
  // getting a set of the ms answered
  const ansMSArr = Object.keys(miles_prev_ans).map(id => Number(id.split('_')[0]))
  // get all
  const all_ms = mile_stones.getRange(2, 1, mile_stones.getLastRow(),mile_stones.getLastColumn()).getValues();
  // filter by proj_type
  const my_ms = all_ms.filter(ms => (ms[mile_stones_sheet_cols['Project_Type_ID']] == proj_type_id))

  const my_milestones = {}
  const all_milestones = {}
  my_ms.forEach(ms => {
    const msID = ms[mile_stones_sheet_cols['Mile_Stone_ID']];
    const obj = {
      ml_id: ms[mile_stones_sheet_cols['ML_ID']],
      proj_type_id: ms[mile_stones_sheet_cols['Project_Type_ID']],
      ml_title: ms[mile_stones_sheet_cols['Mile_Stones']],
      required: ms[mile_stones_sheet_cols['Required_Ind']]
    }
    if (obj.required || ansMSArr.includes(Number(msID))) { // only if ms is required or has answers already
      my_milestones[msID] = obj
    }
    all_milestones[msID] = obj
  })
  return { miles_stones: my_milestones, milestones_ans: miles_prev_ans, all_milestones_options: all_milestones }; 
}

function getUserData(email) {
  const allUsers = users_sheet.getRange(1, 1, users_sheet.getLastRow(), users_sheet.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allUsers.shift());
  const myUser = allUsers.find(user => (user[cols['User_Mail']] == email))
  if (!myUser.length) { console.error('user_not_found') }
  return {
    id: myUser[cols['User_ID']],
    email: myUser[cols['User_Mail']],
    firstName: myUser[cols['User_First_Name']],
    lastName: myUser[cols['User_Last_Name']],
    depID: myUser[cols['User_Dep_ID']]				
  }
}
function getDepData(depID) {
  const allDeps = department_sheet.getRange(1, 1, department_sheet.getLastRow(), department_sheet.getLastColumn()).getValues();
  const cols = headersArrToIndexesObj(allDeps.shift());
  const myDep = allDeps.find(dep => (dep[cols['Dep_ID']] == depID))
  if (!myDep.length) { console.error('dep_not_found') }
  return {
    id: myDep[cols['Dep_ID']],
    name: myDep[cols['Dep_Name']],
    type: myDep[cols['Dep_Type']]
  }
}
function getAllProjectTypes() {
  const allTypes = projects_type.getRange(1, 1, projects_type.getLastRow(), projects_type.getLastColumn()).getValues();
  const types_cols = headersArrToIndexesObj(allTypes.shift());

  const typesObj = {}
  allTypes.forEach((t) => {
    const typeID = t[types_cols['Project_Type_ID']]
    const typeName = t[types_cols['Project_Type']]
    typesObj[typeID] = typeName
  })
  return typesObj
}
function getDepProjects(depID) {
  const allProjects = projects.getRange(1, 1, projects.getLastRow(), projects.getLastColumn()).getValues();

  const cols = headersArrToIndexesObj(allProjects.shift());
  const theDepProjects = allProjects.filter(proj => (proj[cols['Project_Dep_ID']] == depID))
  if (!theDepProjects.length) { console.error('projects_not_found') }

  const allTypes = getAllProjectTypes();

  const myProjects = theDepProjects.map((proj) => {
    return {
      id: proj[cols['Project_ID']],
      codeTakana: proj[cols['Project_Code_TAKANA']],
      name: proj[cols['Project_Name']],
      status: proj[cols['Project_Status']],
      isFunded: (proj[cols['Project_Funded_Ind']] == 'Funded') ? true : false,
      typeID: proj[cols['Project_Type_ID']],
      typeName: allTypes[proj[cols['Project_Type_ID']]]
    }
  })

  return myProjects;
}
function getPagesData() {
  const allPages = data_pages.getRange(1, 1, data_pages.getLastRow(), data_pages.getLastColumn()).getValues();

  const cols = headersArrToIndexesObj(allPages.shift());
  const pages = {}
  allPages.forEach((p) => {
    const pageNum = Number(p[cols['Page_Number']])
    const page = {
      number: pageNum,
      title: p[cols['Page_Title']],
      desc: p[cols['Page_Desc']],
      prefix: p[cols['Page_Ques_Prefix']],
    }
    pages[pageNum] = page;
  })
  return pages;
}
function getUserRelevantData() {
  const email = Session.getEffectiveUser().getEmail();
  if (!email) { console.error('no user') }

  const userData = {}
  userData['myUser'] = getUserData(email)
  userData['myDep'] = getDepData(userData['myUser'].depID)
  userData['myProjects'] = getDepProjects(userData['myUser'].depID)
  userData['pagesData'] = getPagesData();

  return userData;
}

function getProjectTypeId(user_proj_id){
  const projects_sheet_cols = getSheetColIndexes(projects)

  let projects_data = projects.getRange(2, 1, projects.getLastRow() - 1,projects.getLastColumn()).getValues();
  let project_info = projects_data.find((proj) => proj[projects_sheet_cols['Project_ID']] == user_proj_id);
  let proj_type_id = project_info[projects_sheet_cols['Project_Type_ID']];
  return proj_type_id;
}

function getPrevAns(user_dep_id, user_proj_id, page_num) {
  let answers;
  const sheet = pagePrefixToDataSheet[pageNumberToPrefix[page_num]];

  const msFakeAnswers = { // TODO !! CHANGE
    'MS_Name': '',
    'MS_Start_Date': '',
    'MS_End_Date': '',
    'MS_Status': '',
    'MS_Buying_Required': '',
    'MS_Product_Desc': '',
    'MS_Product_Done': '',
  }
  
  switch (page_num) {
    case pagePrefixToNumber['DT']:
      answers = getAnsForPage(sheet,user_proj_id, "DT_Project_ID"); //answers for page 1
      break;
    case pagePrefixToNumber['MS']:
      answers = msFakeAnswers;//answers for page 2 are empty
      break;
    case pagePrefixToNumber['Barrier']:
    case pagePrefixToNumber['Readiness']:
      answers = getAnsForPage(sheet, user_dep_id, "Project_Dep_ID");//answers for page 3
      break;  
    case pagePrefixToNumber['Training']:
      answers = getAnsForPage(sheet, user_dep_id, "Dep_ID");//answers for page 5
      break;
  }
  return answers;
}

function getAnsForPage(curr_sheet, idValue, idCol){
  const allAnswers = curr_sheet.getRange(1, 1, curr_sheet.getLastRow(),curr_sheet.getLastColumn()).getValues();
  const sheet_col_indexes = headersArrToIndexesObj(allAnswers.shift());
  const myAnswers = allAnswers.filter(a => (a[sheet_col_indexes[idCol]] == idValue)).flat()
  const questionWithAnswers = {}
  Object.entries(sheet_col_indexes).forEach(([qName, qIndex]) => {
    questionWithAnswers[qName] = myAnswers[qIndex]
  });
  return questionWithAnswers;
}

function saveNewAnswers(page, answers, user_proj_id, user_dep_id) {
  const curr_time = getCurrDateTime();
  if (page == pagePrefixToNumber['MS']) {
    saveMSAnswers(answers, user_proj_id, curr_time);
    return true
  }
  let id_col_name;
  let proj_o_dep_id;
  if (page == pagePrefixToNumber['DT']) {
    id_col_name = "DT_Project_ID";
    proj_o_dep_id = user_proj_id;
  } else if (page == pagePrefixToNumber['Training']) {
    id_col_name = "Dep_ID"
    proj_o_dep_id = user_dep_id;
  } else { // readiness or barrier
    id_col_name = "Project_Dep_ID";
    proj_o_dep_id = user_dep_id;
  }
  const sheet = pagePrefixToDataSheet[pageNumberToPrefix[page]]

  handlePageAns(answers, proj_o_dep_id, id_col_name, sheet, curr_time);
  return true
}

function handlePageAns(answers, proj_or_dep_id, proj_or_dep_col, curr_sheet, curr_time){
  const usersAnswers = curr_sheet.getRange(1, 1, curr_sheet.getLastRow(), curr_sheet.getLastColumn()).getValues();
  const headers = usersAnswers.shift();
  const sheet_col_indexes = headersArrToIndexesObj(headers);
  
  const myAnswersInd = usersAnswers.findIndex((row) => row[sheet_col_indexes[proj_or_dep_col]] == proj_or_dep_id);
  let sheetsIndex = (myAnswersInd == -1) ? curr_sheet.getLastRow()+1 : myAnswersInd+2; 

  const readyForSheets = [];
  headers.forEach((ques, i) => {
    let ans = "";
    if (ques == proj_or_dep_col) { ans = proj_or_dep_id }
    else if (ques == "Last_Updated") { ans = curr_time }
    else { ans = answers[ques] || "" }
    readyForSheets.push(ans);
  })

  curr_sheet.getRange(sheetsIndex, 1, 1, curr_sheet.getLastColumn()).setValues([readyForSheets]);
}

function saveMSAnswers(answers, user_proj_id, curr_time) {
  let user_proj_type_id = getProjectTypeId(user_proj_id);//check if you even need this column! you added it
  for (let ml_unique_key in answers){
    new_ans = answers[ml_unique_key]; 
    ids = ml_unique_key.split('_');
    new_ans.unshift(user_proj_id, user_proj_type_id, ids[0],ids[1]);
    new_ans.push(curr_time);
    data_mile_stones.appendRow(new_ans); //what if im adding in a way the the biggest id isn't in the last row. I probably dont. so find the max in a col, or mabey you can force the col in google sheet to do so. or just use option 1 in getMilesStones().
  }
}

function getMilesStonesData(user_proj_id){
  const ms_data_sheet_cols = getSheetColIndexes(data_mile_stones)

  const all_ms_answers = data_mile_stones.getRange(2, 1, data_mile_stones.getLastRow() - 1,data_mile_stones.getLastColumn()).getValues();
  let proj_ms_answers = all_ms_answers.filter(ms => (ms[ms_data_sheet_cols['MS_Project_ID']] == user_proj_id))
  proj_ms_answers = keepLatestAnswers(proj_ms_answers, ms_data_sheet_cols['MS_Name'], ms_data_sheet_cols['Last_Updated'])

  const miles_stone_ans = {};
  proj_ms_answers.forEach(msa => {
    let ml_stone_id = msa[ms_data_sheet_cols['MS_Mile_Stone_ID']];
    let ml_unique_id = msa[ms_data_sheet_cols['MS_Unique_ID']];
    let ml_start_date = msa[ms_data_sheet_cols['MS_Start_Date']];
    let ml_end_date = msa[ms_data_sheet_cols['MS_End_Date']];
    if (ml_start_date) { ml_start_date = ml_start_date.toString() }
    if (ml_end_date) { ml_end_date = ml_end_date.toString() }
    // I can do it because the questions in section 2 are fixed and you always have them all.
    miles_stone_ans[ml_stone_id+'_'+ml_unique_id] = {
      'MS_Name': msa[ms_data_sheet_cols['MS_Name']],
      'MS_Start_Date': ml_start_date,
      'MS_End_Date': ml_end_date,
      'MS_Status': msa[ms_data_sheet_cols['MS_Status']],
      'MS_Buying_Required': msa[ms_data_sheet_cols['MS_Buying_Required']],
      'MS_Product_Desc': msa[ms_data_sheet_cols['MS_Product_Desc']],
      'MS_Product_Done': msa[ms_data_sheet_cols['MS_Product_Done']]
    };
  })
  return miles_stone_ans;
}

// Latest Answers assume that all the last answers have the same last_updated
function keepLatestAnswers(data, ms_name_index, last_updated_index) {
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
        if (!entry[ms_name_index]) { return false } // ignore ones without ms name
        const entryDate = new Date(entry[last_updated_index]);
        return (entryDate.getTime() === mostRecentDate.getTime());
    });
    return filteredData;
}
