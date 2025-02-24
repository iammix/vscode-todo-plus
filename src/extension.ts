/* IMPORT */

import * as vscode from 'vscode';
import beggar from 'vscode-beggar';
import Config from './config';
import Consts from './consts';
import CompletionProvider from './providers/completion';
import SymbolsProvider from './providers/symbols';
import DocumentDecorator from './todo/decorators/document';
import ChangesDecorator from './todo/decorators/changes';
import Utils from './utils';
import ViewEmbedded from './views/embedded';
import ViewFiles from './views/files';

// Import node-fetch (ensure it's installed via npm)
import fetch from 'node-fetch';

/* ACTIVATE */

const activate = function ( context: vscode.ExtensionContext ) {

  beggar ({
    id: 'vscode-todo-plus',
    title: '𝗧𝗼𝗱𝗼+ - 𝗙𝘂𝗻𝗱𝗿𝗮𝗶𝘀𝗶𝗻𝗴 𝗔𝗻𝗻𝗼𝘂𝗻𝗰𝗲𝗺𝗲𝗻𝘁: We are collecting some money to allow for further development, if you find this extension useful please please please consider donating to it and be part of something amazing!',
    url: 'https://buy.stripe.com/4gweWHcsh71lbN6dQQ',
    actions: {
      yes: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22vscode-todo-plus%22%2C%22result%22%3A1%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      },
      no: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22vscode-todo-plus%22%2C%22result%22%3A0%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      },
      cancel: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22vscode-todo-plus%22%2C%22result%22%3A2%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      }
    }
  });

  const config = Config.get ();

  Config.check ( config );

  ViewEmbedded.expanded = config.embedded.view.expanded;

  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', ViewEmbedded.expanded );
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered', !!ViewEmbedded.filter );

  ViewEmbedded.all = true;

  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-all', !!ViewEmbedded.all );

  ViewFiles.expanded = config.file.view.expanded;

  vscode.commands.executeCommand ( 'setContext', 'todo-files-expanded', ViewFiles.expanded );
  vscode.commands.executeCommand ( 'setContext', 'todo-files-open-button', true );

  Utils.context = context;
  Utils.folder.initRootsRe ();
  Utils.init.language ();
  Utils.init.views ();
  Utils.statistics.tokens.updateDisabledAll ();

  context.subscriptions.push (
    vscode.languages.registerCompletionItemProvider ( Consts.languageId, new CompletionProvider (), ...CompletionProvider.triggerCharacters ),
    vscode.languages.registerDocumentSymbolProvider ( Consts.languageId, new SymbolsProvider () ),
    vscode.window.onDidChangeActiveTextEditor ( () => DocumentDecorator.update () ),
    vscode.workspace.onDidChangeConfiguration ( Consts.update ),
    vscode.workspace.onDidChangeConfiguration ( () => {
      delete Utils.files.filesData;
      if ( Utils.embedded.provider ) delete Utils.embedded.provider.filesData;
    }),
    vscode.workspace.onDidChangeConfiguration ( () => DocumentDecorator.update () ),
    vscode.workspace.onDidChangeConfiguration ( Utils.statistics.tokens.updateDisabledAll ),
    vscode.workspace.onDidChangeTextDocument ( ChangesDecorator.onChanges ),
    vscode.workspace.onDidChangeWorkspaceFolders ( () => Utils.embedded.provider && Utils.embedded.provider.unwatchPaths () ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.files.unwatchPaths ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.folder.initRootsRe )
  );

  DocumentDecorator.update ();

  // Register the new Trello integration command.
  const disposableTrello = vscode.commands.registerCommand('todoPlus.sendTodoToTrello', async () => {
    // Prompt the user for the todo title and description.
    const title = await vscode.window.showInputBox({ prompt: 'Enter todo title' });
    if (!title) {
      vscode.window.showErrorMessage('Title is required.');
      return;
    }
    const description = await vscode.window.showInputBox({ prompt: 'Enter todo description' });
    const todo = { title, description: description || '' };

    try {
      await sendTodoToTrello(todo);
      vscode.window.showInformationMessage('Todo sent to Trello successfully!');
    } catch (error) {
      vscode.window.showErrorMessage('Failed to send todo to Trello. See console for details.');
      console.error(error);
    }
  });
  context.subscriptions.push(disposableTrello);

  return Utils.init.commands ( context );
};

/* HELPER FUNCTION: Trello Integration */

async function sendTodoToTrello(todo: { title: string, description: string }): Promise<void> {
  // Get configuration from the workspace settings under "todoPlus"
  const config = vscode.workspace.getConfiguration('todoPlus');
  const trelloKey = config.get<string>('trello.key');
  const trelloToken = config.get<string>('trello.token');
  const listId = config.get<string>('trello.listId');

  if (!trelloKey || !trelloToken || !listId) {
    throw new Error('Trello configuration is missing. Please set your API key, token, and list ID in the settings.');
  }

  // Construct the Trello API URL and request body.
  const url = `https://api.trello.com/1/cards?key=${trelloKey}&token=${trelloToken}`;
  const body = {
    idList: listId,
    name: todo.title,
    desc: todo.description
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creating Trello card: ${response.statusText}. Details: ${errorText}`);
  }

  const data = await response.json();
  console.log('Trello card created:', data);
}

/* EXPORT */

export { activate };
