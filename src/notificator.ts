import { GasWebClient as SlackClient } from '@hi-se/web-api';

const DATE_COL = 3;
const CHANNEL_ID = 'C01A63N258D';
const PAYDAY = 25;

const notificator = () => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.SPREADSHEET_ID);
  
  notifyAnniversary(spreadsheet);
  notifyPayday(spreadsheet);
}

const notifyAnniversary = (spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) => {
  const dataSheet = spreadsheet.getSheets()[0];
  const configSheet = spreadsheet.getSheets()[1];
  const todayDate = new Date();

  let defaultMessage: { [key: string]: string; } = {};
  for (let row of configSheet.getDataRange().getValues().slice(1)) {
    defaultMessage[row[0]] = row[1];
  }

  const textFinder = dataSheet.createTextFinder(Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM/dd'))
    .matchEntireCell(false);
  
  const ranges = textFinder.findAll();

  for (let range of ranges) {
    const row = range.getRow();
    const [_, type, date, name, message] = dataSheet.getRange(row, 1, 1, 5).getValues()[0];

    if (range.getColumn() == DATE_COL) {
      if (!isNaN(Date.parse(date)) && isMatch(todayDate, date)) {
        const postMessage = createMessage(name, date, todayDate, defaultMessage[type] + '\n' + message);
        postSlackChannel(postMessage);
      }
    }
  }
}

const isMatch = (anniversaryDate: Date, todayDate: Date): boolean => {
  if (todayDate.getMonth() === anniversaryDate.getMonth() && todayDate.getDate() === anniversaryDate.getDate()) {
    return true;
  }
  return false;
}

const createMessage = (name: string, date: Date, current: Date, message: string): string => {
  const years = String(current.getFullYear() - date.getFullYear());
  return message.replace(/NAME/g, name).replace(/YEARS/g, years);
}

const notifyPayday = (spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) => {
  const configSheet = spreadsheet.getSheets()[1];

  let defaultMessage: { [key: string]: string; } = {};
  for (let row of configSheet.getDataRange().getValues().slice(1)) {
    defaultMessage[row[0]] = row[1];
  }

  if (isPayday()) {
    postSlackChannel(defaultMessage['給料日']);
  }
}

const isPayday = () => {
  let d = new Date();
  if (d.getDate() == PAYDAY) {
    return true;
  } else {
    for (d.setDate(d.getDate()+1); isHoliday(d); d.setDate(d.getDate()+1)) {
      if (d.getDate() == PAYDAY) {
        return true;
      }
    }
  }
  return false;
}

const isHoliday = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  if(dayOfWeek <= 0 || 6 <= dayOfWeek){
    return true;
  }

  const calendarId = "ja.japanese#holiday@group.v.calendar.google.com";
  const calendar = CalendarApp.getCalendarById(calendarId);
  const todayEvents = calendar.getEventsForDay(date);
  if(todayEvents.length > 0){
    return true;
  }
  return false;
}

const getSlackClient = (): SlackClient => {
  const token: string = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
  return new SlackClient(token);
}

const postSlackChannel = (message: string) => {
  const client = getSlackClient();
  const result = client.chat.postMessage(
    {
      channel: CHANNEL_ID,
      text: message,
    }
  );
}

/*
const debugLogger = (log: any) => {
  const SPREADSHEET_ID: string = '17MNAuy28_OaeZsMYuuEHIiNZdtjdx8Sxuv_QpSL0SKY';
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = spreadsheet.getSheets()[2];
  const lastRow = logSheet.getLastRow() + 1;
  logSheet.getRange(lastRow, 1).setValue(Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss"));
  logSheet.getRange(lastRow, 2).setValue(log);
}
*/

declare const global: any;
global.notificator = notificator;
