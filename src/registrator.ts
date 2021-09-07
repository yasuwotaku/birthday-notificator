import { SlackAction, BlockAction, ViewUpdateResponseAction, ViewPushResponseAction } from '@slack/bolt';
import { SlackShortcut, GlobalShortcut } from '@slack/bolt';
import { SlackViewAction, ViewSubmitAction } from '@slack/bolt';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { ViewsOpenArguments, ViewsPushArguments } from '@hi-se/web-api/src/methods';
import * as modals from './modals';

const TYPE_COL = 2;
const NAME_COL = 4;

const doPost = (e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput => {
  return ack(slackHandler(e));
}

const ack = (payload: string): GoogleAppsScript.Content.TextOutput => {
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

const isAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'block_actions';
  }
  return false;
}

const isViewAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'view_submission' || type === 'view_closed';
  }
  return false;
}

const isShortcut = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'shortcut';
  }
  return false;
}

const getSlackClient = (): SlackClient => {
  const token: string = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
  return new SlackClient(token);
}

const slackHandler = (e: GoogleAppsScript.Events.DoPost): string => {
  const client: SlackClient = getSlackClient();
  if (isAction(e)) {
    return handleSlackAction(client, JSON.parse(e.parameter['payload']));
  }
  else if (isViewAction(e)) {
    return handleSlackViewAction(client, JSON.parse(e.parameter['payload']));
  }
  else if (isShortcut(e)) {
    return handleSlackShortcut(client, JSON.parse(e.parameter['payload']));
  }
}

const handleSlackAction = (client: SlackClient, payload: SlackAction): string => {
  switch (payload.type) {
    case 'block_actions':
      return handleBlockAction(client, payload);
    case 'interactive_message':
      break;
    case 'dialog_submission':
      break;
    case 'workflow_step_edit':
      break;
  }
}

const handleSlackShortcut = (client: SlackClient, payload: SlackShortcut): string => {
  switch (payload.type) {
    case 'shortcut':
      return handleGlobalShortcut(client, payload);
    case 'message_action':
      break;
  }
}

const handleSlackViewAction = (client: SlackClient, payload: SlackViewAction): string => {
  switch (payload.type) {
    case 'view_submission':
      return handleViewSubmitAction(client, payload);
    case 'view_closed':
      break;
  }
}

const handleBlockAction = (client: SlackClient, payload: BlockAction): string => {
  switch (payload.actions[0].action_id) {
    case 'click_register':
      return pushRegisterModal(client, payload);
    case 'click_delete':
      return pushDeleteModal(client, payload)
  }
}

const handleGlobalShortcut = (client: SlackClient, payload: GlobalShortcut): string => {
  if (payload.callback_id == 'register_anniversary') {
    return openHomeModal(client, payload);
  }
}

const pushRegisterModal = (client: SlackClient, payload: BlockAction): string => {
  const data: ViewsPushArguments = {
    'trigger_id': payload.trigger_id,
    'token': PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN'),
    'view': modals.registerModal(),
  };

  client.views.push(data);
  return '';
}

const pushDeleteModal = (client: SlackClient, payload: BlockAction): string => {
  const data: ViewsPushArguments = {
    'trigger_id': payload.trigger_id,
    'token': PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN'),
    'view': modals.deleteModal(),
  };

  client.views.push(data);
  return '';
}

const openHomeModal = (client: SlackClient, payload: GlobalShortcut): string => {
  const data: ViewsOpenArguments = {
    'trigger_id': payload.trigger_id,
    'token': PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN'),
    'view': modals.homeModal(),
  };

  client.views.open(data);
  return '';
}

const handleViewSubmitAction = (client: SlackClient, payload: ViewSubmitAction): string => {
  switch (payload.view.title.text) {
    case '登録':
      if (registerAnniversaryDate(payload)) {
        return updateRegisterResultModal(client, payload);
      } else {
        return pushRegisterFailedModal(client, payload);
      }
    case '削除':
      if (findAnniversaryDate(payload)) {
        return pushDeleteConfirmModal(client, payload);
      } else {
        return pushNotFoundModal(client, payload);
      }
    case '削除確認':
      if (deleteAnniversaryDate(payload)) {
        return updateDeleteResultModal(client, payload);
      }
  }
}

const updateRegisterResultModal = (client: SlackClient, payload: ViewSubmitAction): string => {
  const response: ViewUpdateResponseAction = {
    'response_action': 'update',
    'view': modals.registerResultModal(payload),
  };

  return JSON.stringify(response);
}

const pushRegisterFailedModal = (client: SlackClient, payload: ViewSubmitAction): string => {
  const response: ViewPushResponseAction = {
    'response_action': 'push',
    'view': modals.registerFailedModal(),
  };
  
  return JSON.stringify(response);
}

const pushDeleteConfirmModal = (client: SlackClient, payload: ViewSubmitAction): string => {
  const response: ViewPushResponseAction = {
    'response_action': 'push',
    'view': modals.deleteConfirmModal(payload),
  };
  return JSON.stringify(response);
}

const pushNotFoundModal = (client: SlackClient, payload: ViewSubmitAction): string => {
  const response: ViewPushResponseAction = {
    'response_action': 'push',
    'view': modals.deleteNotFoundModal(payload),
  };
  return JSON.stringify(response);
}

const updateDeleteResultModal = (client: SlackClient, payload: ViewSubmitAction): string => {
  const response: ViewUpdateResponseAction = {
    'response_action': 'update',
    'view': modals.deleteResultModal(),
  };
  return JSON.stringify(response);
}

const registerAnniversaryDate = (payload: ViewSubmitAction): boolean => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  const typeRequested = payload.view.state.values.type.content.selected_option.text.text;
  const dateRequested = payload.view.state.values.date.content.selected_date;
  const nameRequested = payload.view.state.values.name.content.value;
  const messageRequested = payload.view.state.values.message.content.value;

  const textFinder = sheet.createTextFinder(nameRequested)
    .ignoreDiacritics(true)
    .matchCase(true)
    .matchEntireCell(true)
    .matchFormulaText(true);
  
  const ranges = textFinder.findAll();

  for (let range of ranges) {
    if (range.getColumn() == NAME_COL) {
      const row = range.getRow();
      const typeRegistered = sheet.getRange(row, TYPE_COL).getValue();
      if (typeRequested === typeRegistered) {
        return false;
      }
    }
  }
  
  const lastRow = sheet.getLastRow() + 1;

  const createdAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const values = [[createdAt, typeRequested, dateRequested, nameRequested, messageRequested]]; 
  sheet.getRange(lastRow, 1, 1, 5).setValues(values);

  return true;
}

const findAnniversaryDate = (payload: ViewSubmitAction): boolean => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  const typeRequested = payload.view.state.values.type.content.selected_option.text.text;
  const nameRequested = payload.view.state.values.name.content.value;

  const textFinder = sheet.createTextFinder(nameRequested)
    .ignoreDiacritics(true)
    .matchCase(true)
    .matchEntireCell(true)
    .matchFormulaText(true);
  
  const ranges = textFinder.findAll();

  for (let range of ranges) {
    if (range.getColumn() == NAME_COL) {
      const row = range.getRow();
      const typeRegistered = sheet.getRange(row, TYPE_COL).getValue();
      if (typeRequested === typeRegistered) {
        return true;
      }
    }
  }
  
  return false;
}

const deleteAnniversaryDate = (payload: ViewSubmitAction): boolean => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  const typeRequested = payload.view.blocks[1].fields[1].text;
  const nameRequested = payload.view.blocks[1].fields[3].text;

  const textFinder = sheet.createTextFinder(nameRequested)
    .ignoreDiacritics(true)
    .matchCase(true)
    .matchEntireCell(true)
    .matchFormulaText(true);
  
  const ranges = textFinder.findAll();

  for (let range of ranges) {
    if (range.getColumn() == NAME_COL) {
      const row = range.getRow();
      const typeRegistered = sheet.getRange(row, TYPE_COL).getValue();
      if (typeRequested === typeRegistered) {
        sheet.deleteRow(row);
        return true;
      }
    }
  }
  
  return false;
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
global.doPost = doPost;