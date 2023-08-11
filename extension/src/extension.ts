import * as vscode from "vscode";
import { TextDocumentPositionParams } from "vscode-languageserver-protocol";
import { createClient } from "@supabase/supabase-js";
import { ProofState, ProofError } from "./types";
import setupStatusBar from "./services/setupStatusBar";
import getWebviewContent from "./services/getWebviewContent";
import vscodeRequest from "./services/vscodeRequest";

const supabaseUrl = "https://rksnswkaoajpdomeblni.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrc25zd2thb2FqcGRvbWVibG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAwNjU2NjgsImV4cCI6MjAwNTY0MTY2OH0.gmF1yF-iBhzlUgalz1vT28Jbc-QoOr5OlgI2MQ5OXhg";
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_SERVER_URL = "https://paperproof.xyz";
let SERVER_URL = DEFAULT_SERVER_URL;

let sessionId: string | null = null;
let latestInfo: ProofState | ProofError | null = null;
let onLeanClientRestarted: vscode.Disposable | null = null;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const sendTypesToServer = async (
  sessionId: string,
  body: ProofState | ProofError
) =>
  await supabase
    .from("sessions")
    .update([{ proof: body }])
    .eq("id", sessionId);

const sendTypes = async (
  webviewPanel: vscode.WebviewPanel | null,
  body: ProofState | ProofError
) => {
  // Save for the later sending in case there is no session for the server or no webview open yet.
  latestInfo = body;

  // 1. Send directly to the webview (if it's open!) to avoid lag
  await webviewPanel?.webview.postMessage(body);

  // 2. After that, send data to .xyz
  if (sessionId) {
    await sendTypesToServer(sessionId, body);
  }
};

const sendInfoAtTdp = async (
  log: vscode.OutputChannel,
  client: any,
  webviewPanel: vscode.WebviewPanel | null,
  tdp: TextDocumentPositionParams
) => {
  const uri = tdp.textDocument.uri;
  const proofTreeResponse = await vscodeRequest(
    log,
    "getSnapshotData",
    client,
    uri,
    tdp,
    { pos: tdp.position }
  );
  const goalsResponse = await vscodeRequest(
    log,
    "Lean.Widget.getInteractiveGoals",
    client,
    uri,
    tdp,
    tdp
  );

  const body: ProofState = {
    goal: (goalsResponse && goalsResponse.goals[0]) || null,
    proofTree: proofTreeResponse.steps,
  };

  await sendTypes(webviewPanel, body);

  log.appendLine("🎉 Sent everything");
};

export function activate(context: vscode.ExtensionContext) {
  // Settings
  const config = vscode.workspace.getConfiguration("paperproof");
  console.log("Config", config);
  SERVER_URL = config.get("serverUrl", DEFAULT_SERVER_URL);

  // Creates the 'paperproof' channel in vscode's "OUTPUT" pane
  let log = vscode.window.createOutputChannel("paperproof");
  let webviewPanel: vscode.WebviewPanel | null = null;

  // Creating a new paperproof working session
  supabase
    .from("sessions")
    .insert([{ proof: {} }])
    .select()
    .then(({ data, error }) => {
      if (error) {
        log.appendLine(
          `❌ Error in creating a new session: "${error.message}"`
        );
        return;
      }
      const id = data[0].id;
      log.appendLine(`🎉 New session: ${id}`);
      sessionId = id;
      if (latestInfo) {
        sendTypesToServer(id, latestInfo).then(() => {
          log.appendLine("🎉 Pending types sent");
        });
      }

      context.subscriptions.push(setupStatusBar(SERVER_URL, id));
    });

  const sendPosition = async (editor: vscode.TextEditor | undefined) => {
    try {
      if (!editor) {
        return;
      }
      const doc = editor.document;
      if (doc.languageId !== "lean4" && doc.languageId !== "lean") {
        return;
      }
      const pos = editor.selection.active;
      let tdp = {
        textDocument: { uri: doc.uri.toString() },
        position: { line: pos.line, character: pos.character },
      };
      log.appendLine("");
      log.appendLine(`Text selection: ${JSON.stringify(tdp)}`);
      const leanExtension = vscode.extensions.getExtension("leanprover.lean4");
      if (!leanExtension) {
        throw new Error("Lean extension not found");
      }
      const clientProvider = leanExtension.exports.clientProvider;
      const [_, client] = await clientProvider.ensureClient(doc.uri, undefined);
      if (!client) {
        throw new Error("Lean client not found");
      }
      if (!client.running) {
        // Dispose of the previous listener if there was one
        onLeanClientRestarted?.dispose();
        onLeanClientRestarted = client.restarted(() => {
          sendInfoAtTdp(log, client, webviewPanel, tdp);
          onLeanClientRestarted?.dispose();
        });
        throw new Error(
          "leanNotYetRunning"
        );
      }
      log.appendLine("Found a Lean client");
      await sendInfoAtTdp(log, client, webviewPanel, tdp);
    } catch (error) {
      const message = getErrorMessage(error);
      log.appendLine(`❌ Error in sendPosition: "${message}"`);
      await sendTypes(webviewPanel, { error: message });
    }
  };

  // Sending types to the server on cursor changes.
  sendPosition(vscode.window.activeTextEditor);
  vscode.window.onDidChangeActiveTextEditor(sendPosition);
  vscode.window.onDidChangeTextEditorSelection((event) => {
    // We should ignore it when the user is selecting some range of text
    if (!event.selections[0].isEmpty) {
      return;
    }
    sendPosition(event.textEditor)
  });

  // Opening/hiding webviewPanel.
  function openPanel() {
    webviewPanel = vscode.window.createWebviewPanel(
      "paperproof",
      "Paper Proof",
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    webviewPanel.onDidDispose(() => {
      webviewPanel = null;
    });
    log.append("Opening webviewPanel with: " + (latestInfo as any)["statement"]);
    webviewPanel.webview.html = getWebviewContent(SERVER_URL, latestInfo);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("paperproof.toggle", () => {
      if (webviewPanel) {
        webviewPanel.dispose();
      } else {
        openPanel();
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }
