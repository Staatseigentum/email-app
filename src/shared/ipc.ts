export const IPC = {
  accountsList: 'accounts:list',
  accountsSave: 'accounts:save',
  accountsDelete: 'accounts:delete',
  accountsTest: 'accounts:test',
  mailboxes: 'mail:mailboxes',
  messages: 'mail:messages',
  message: 'mail:message',
  markSeen: 'mail:markSeen',
  flag: 'mail:flag',
  deleteMessage: 'mail:delete',
  send: 'mail:send',
  sync: 'mail:sync',
  openExternal: 'app:openExternal',
  oauthStart: 'oauth:start',
  oauthConfigGet: 'oauth:configGet',
  oauthConfigSet: 'oauth:configSet',
  oauthImportGoogle: 'oauth:importGoogle',
  // main -> renderer events
  onStatus: 'evt:status',
  onNewMail: 'evt:newMail'
} as const
