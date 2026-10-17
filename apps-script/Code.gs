/**
 * Shipping Pulse — Google Sheets read-only bridge (stage 1)
 * Deploy only to trusted Google Workspace users. Never publish customer data
 * to an anonymous web-app URL. This bridge deliberately has NO write methods.
 * Configure SPREADSHEET_ID in Script Properties, not in public GitHub code.
 */
const REQUIRED_TABS = ['ORDERS', 'DRIVERS', 'TRACKING', 'COLLECTIONS', 'SETTINGS'];
function getWorkbook_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID is missing from Script Properties');
  return SpreadsheetApp.openById(id);
}
function sheetRows_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values.shift().map((x,i)=>String(x).trim() || 'column_'+(i+1));
  return values.filter(row=>row.some(v=>String(v).trim())).map(row=>{
    const item={};headers.forEach((h,i)=>item[h]=row[i]??'');return item;
  });
}
/**
 * Run from Apps Script editor, after setting Script Properties.
 * Outputs tab names and row counts ONLY; no personal data in logs.
 */
function testConnection() {
  const wb=getWorkbook_();
  const result={spreadsheetTitle:wb.getName(),tabs:{}};
  REQUIRED_TABS.forEach(name=>{
    const tab=wb.getSheetByName(name);
    result.tabs[name]=tab?Math.max(0,tab.getLastRow()-1):'MISSING';
  });
  Logger.log(JSON.stringify(result));
  return result;
}
/**
 * Server-side function for a future authenticated deployment.
 * Not exposed as doGet/doPost because an anonymous public endpoint
 * would leak private order and collection information.
 */
function readOrdersForAuthorizedUser() {
  const wb=getWorkbook_();
  const tab=wb.getSheetByName('ORDERS');
  if (!tab) throw new Error('ORDERS tab not found');
  return sheetRows_(tab);
}
