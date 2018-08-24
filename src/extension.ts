'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    //console.log('Congratulations, your extension "jsonviewer" is now active!');
    // Track currently webview panel
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.viewJson', () => {
        // The code you place here will be executed every time your command is executed

        const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        if (currentPanel) {
            // If we already have a panel, show it in the target column
            currentPanel.reveal(columnToShowIn);
            currentPanel.webview.html = jsonToHTML(editor.document.getText(), editor.document.uri.toString());
        } else {

            // Create and show a new webview
            currentPanel = vscode.window.createWebviewPanel(
                'ccjsonviewer', // Identifies the type of the webview. Used internally
                "JsonViewer", // Title of the panel displayed to the user
                vscode.ViewColumn.One, // Editor column to show the new webview panel in.
                { 
                    enableScripts: true,
                    localResourceRoots: [
                      vscode.Uri.file(path.join(context.extensionPath, 'webres'))
                    ]
                } // Webview options. More on these later.
            );
            // And set its HTML content
            currentPanel.webview.html = jsonToHTML(editor.document.getText(), editor.document.uri.toString());
            
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);
        }
    
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

/**
 * The JSONFormatter helper module. This contains two major functions, jsonToHTML and errorPage,
 * each of which returns an HTML document.
 */

/** Convert a whole JSON value / JSONP response into a formatted HTML document */
export function jsonToHTML(json: any, uri: string) {
    if(typeof json === 'string'){
        try{
            json = JSON.parse(json);
        }
        catch(e){
            //console.log(e);
            let error:Error = e;
            
           return error.stack || "Unknown exception occured on JSON parse.";
        }
        
    }
    return toHTML(JSON.stringify(json), uri);
    //return toHTML(jsonToHTMLBody(json), uri);
  }
  
  /** Convert a whole JSON value / JSONP response into an HTML body, without title and scripts */
  function jsonToHTMLBody(json: any) {
    return `<div id="json">${valueToHTML(json, '<root>')}</div>`;
  }
  
  
  /**
   * Encode a string to be used in HTML
   */
  function htmlEncode(t: any): string {
    return (typeof t !== "undefined" && t !== null) ? t.toString()
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      : '';
  }
  
  /**
   * Completely escape a json string
   */
  function jsString(s: string): string {
    // Slice off the surrounding quotes
    s = JSON.stringify(s).slice(1, -1);
    return htmlEncode(s);
  }
  
  /**
   * Is this a valid "bare" property name?
   */
  function isBareProp(prop: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_\-$]*$/.test(prop);
  }
  
  /**
   * Surround value with a span, including the given className
   */
  function decorateWithSpan(value: any, className: string) {
    return `<span class="${className}">${htmlEncode(value)}</span>`;
  }
  
  // Convert a basic JSON datatype (number, string, boolean, null, object, array) into an HTML fragment.
  function valueToHTML(value: any, path: string) {
    const valueType = typeof value;
  
    if (value === null) {
      return decorateWithSpan('null', 'null');
    } else if (Array.isArray(value)) {
      return arrayToHTML(value, path);
    } else if (valueType === 'object') {
      return objectToHTML(value, path);
    } else if (valueType === 'number') {
      return decorateWithSpan(value, 'num');
    } else if (valueType === 'string' &&
              value.charCodeAt(0) === 8203 &&
              !isNaN(value.slice(1))) {
      return decorateWithSpan(value.slice(1), 'num');
    } else if (valueType === 'string') {
      if (/^(http|https|file):\/\/[^\s]+$/i.test(value)) {
        return `<a href="${htmlEncode(value)}"><span class="q">&quot;</span>${jsString(value)}<span class="q">&quot;</span></a>`;
      } else {
        return `<span class="string">&quot;${jsString(value)}&quot;</span>`;
      }
    } else if (valueType === 'boolean') {
      return decorateWithSpan(value, 'bool');
    }
  
    return '';
  }
  
  // Convert an array into an HTML fragment
  function arrayToHTML(json: any, path: string) {
    if (json.length === 0) {
      return '[ ]';
    }
  
    let output = '';
    for (let i = 0; i < json.length; i++) {
      const subPath = `${path}[${i}]`;
      output += '<li>' + valueToHTML(json[i], subPath);
      if (i < json.length - 1) {
        output += ',';
      }
      output += '</li>';
    }
    return (json.length === 0 ? '' : '<span class="collapser"></span>') +
      `[<ul class="array collapsible">${output}</ul>]`;
  }
  
  // Convert a JSON object to an HTML fragment
  function objectToHTML(json: any, path: string) {
    let numProps = Object.keys(json).length;
    if (numProps === 0) {
      return '{ }';
    }
  
    let output = '';
    for (const prop in json) {
      let subPath = '';
      let escapedProp = JSON.stringify(prop).slice(1, -1);
      const bare = isBareProp(prop);
      if (bare) {
        subPath = `${path}.${escapedProp}`;
      } else {
        escapedProp = `"${escapedProp}"`;
      }
      output += `<li><span class="prop${(bare ? '' : ' quoted')}" title="${htmlEncode(subPath)}"><span class="q">&quot;</span>${jsString(prop)}<span class="q">&quot;</span></span>: ${valueToHTML(json[prop], subPath)}`;
      if (numProps > 1) {
        output += ',';
      }
      output += '</li>';
      numProps--;
    }
  
    return `<span class="collapser"></span>{<ul class="obj collapsible">${output}</ul>}`;
  }
  /*
  // Clean up a JSON parsing error message
  function massageError(error: Error): {
    message: string;
    line?: number;
    column?: number;
  } {
    if (!error.message) {
      return error;
    }
  
    const message = error.message.replace(/^JSON.parse: /, '').replace(/of the JSON data/, '');
    const parts = /line (\d+) column (\d+)/.exec(message);
    if (!parts || parts.length !== 3) {
      return error;
    }
  
    return {
      message: htmlEncode(message),
      line: Number(parts[1]),
      column: Number(parts[2])
    };
  }
  
  function highlightError(data: string, lineNum?: number, columnNum?: number) {
    if (!lineNum || !columnNum) {
      return htmlEncode(data);
    }
  
    const lines = data.match(/^.*((\r\n|\n|\r)|$)/gm)!;
  
    let output = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      if (i === lineNum - 1) {
        output += '<span class="errorline">';
        output += `${htmlEncode(line.substring(0, columnNum - 1))}<span class="errorcolumn">${htmlEncode(line[columnNum - 1])}</span>${htmlEncode(line.substring(columnNum))}`;
        output += '</span>';
      } else {
        output += htmlEncode(line);
      }
    }
  
    return output;
  }
  */
  
  // Wrap the HTML fragment in a full document. Used by jsonToHTML and errorPage.
  function toHTML(content: string, title: string) {
    let cssHtml = getStaticCSS();
  return `<!DOCTYPE HTML><html><head><title>${htmlEncode(title)} | Viewer</title>
  <style type="text/css"> `+cssHtml+` </style>
  <script src="http://jsoneditoronline.org/app.min.js" type="text/javascript"></script>
  <style type="text/css">    body {      font: 12pt;    }    #jsoneditor {      width: 100%;    }</style></head><body><div id="jsoneditor"></div><script>  var container = document.getElementById('jsoneditor');var options = {    mode: 'view'  };var json = ${content};var editor = new JSONEditor(container, options, json);</script></body></html>`;
  }


  function getStaticCSS(){
    return 'div.jsoneditor .jsoneditor-search input{height:auto;border:inherit}div.jsoneditor .jsoneditor-search input:focus{border:none!important;box-shadow:none!important}div.jsoneditor table{border-collapse:collapse;width:auto}div.jsoneditor td,div.jsoneditor th{padding:0;display:table-cell;text-align:left;vertical-align:inherit;border-radius:inherit}div.jsoneditor-field,div.jsoneditor-readonly,div.jsoneditor-value{border:1px solid transparent;min-height:16px;min-width:32px;padding:2px;margin:1px;word-wrap:break-word;float:left}div.jsoneditor-field p,div.jsoneditor-value p{margin:0}div.jsoneditor-value{word-break:break-word}div.jsoneditor-readonly{min-width:16px;color:grey}div.jsoneditor-empty{border-color:#d3d3d3;border-style:dashed;border-radius:2px}div.jsoneditor-field.jsoneditor-empty::after,div.jsoneditor-value.jsoneditor-empty::after{pointer-events:none;color:#d3d3d3;font-size:8pt}div.jsoneditor-field.jsoneditor-empty::after{content:"field"}div.jsoneditor-value.jsoneditor-empty::after{content:"value"}a.jsoneditor-value.jsoneditor-url,div.jsoneditor-value.jsoneditor-url{color:green;text-decoration:underline}a.jsoneditor-value.jsoneditor-url{display:inline-block;padding:2px;margin:2px}a.jsoneditor-value.jsoneditor-url:focus,a.jsoneditor-value.jsoneditor-url:hover{color:#ee422e}div.jsoneditor td.jsoneditor-separator{padding:3px 0;vertical-align:top;color:grey}div.jsoneditor-field.jsoneditor-highlight,div.jsoneditor-field[contenteditable=true]:focus,div.jsoneditor-field[contenteditable=true]:hover,div.jsoneditor-value.jsoneditor-highlight,div.jsoneditor-value[contenteditable=true]:focus,div.jsoneditor-value[contenteditable=true]:hover{background-color:#ffffab;border:1px solid #ff0;border-radius:2px}div.jsoneditor-field.jsoneditor-highlight-active,div.jsoneditor-field.jsoneditor-highlight-active:focus,div.jsoneditor-field.jsoneditor-highlight-active:hover,div.jsoneditor-value.jsoneditor-highlight-active,div.jsoneditor-value.jsoneditor-highlight-active:focus,div.jsoneditor-value.jsoneditor-highlight-active:hover{background-color:#fe0;border:1px solid #ffc700;border-radius:2px}div.jsoneditor-value.jsoneditor-string{color:green}div.jsoneditor-value.jsoneditor-array,div.jsoneditor-value.jsoneditor-object{min-width:16px;color:grey}div.jsoneditor-value.jsoneditor-number{color:#ee422e}div.jsoneditor-value.jsoneditor-boolean{color:#ff8c00}div.jsoneditor-value.jsoneditor-null{color:#004ed0}div.jsoneditor-value.jsoneditor-invalid{color:#000}div.jsoneditor-tree button.jsoneditor-button{width:24px;height:24px;padding:0;margin:0;border:none;cursor:pointer;background:transparent url(img/jsoneditor-icons.svg)}div.jsoneditor-mode-form tr.jsoneditor-expandable td.jsoneditor-tree,div.jsoneditor-mode-view tr.jsoneditor-expandable td.jsoneditor-tree{cursor:pointer}div.jsoneditor-tree button.jsoneditor-collapsed{background-position:0 -48px}div.jsoneditor-tree button.jsoneditor-expanded{background-position:0 -72px}div.jsoneditor-tree button.jsoneditor-contextmenu{background-position:-48px -72px}div.jsoneditor-tree button.jsoneditor-contextmenu.jsoneditor-selected,div.jsoneditor-tree button.jsoneditor-contextmenu:focus,div.jsoneditor-tree button.jsoneditor-contextmenu:hover,tr.jsoneditor-selected.jsoneditor-first button.jsoneditor-contextmenu{background-position:-48px -48px}div.jsoneditor-tree :focus{outline:0}div.jsoneditor-tree button.jsoneditor-button:focus{background-color:#f5f5f5;outline:#e5e5e5 solid 1px}div.jsoneditor-tree button.jsoneditor-invisible{visibility:hidden;background:0 0}div.jsoneditor-tree div.jsoneditor-show-more{display:inline-block;padding:3px 4px;margin:2px 0;background-color:#e5e5e5;border-radius:3px;color:grey;font-family:arial,sans-serif;font-size:10pt}div.jsoneditor-tree div.jsoneditor-show-more a{display:inline-block;color:grey}div.jsoneditor-tree div.jsoneditor-show-more a:focus,div.jsoneditor-tree div.jsoneditor-show-more a:hover{color:#ee422e}div.jsoneditor-tree div.jsoneditor-color{display:inline-block;width:12px;height:12px;margin:4px;border:1px solid grey;cursor:pointer}div.jsoneditor-tree div.jsoneditor-color .picker_wrapper.popup.popup_bottom{top:28px;left:-10px}div.jsoneditor-tree div.jsoneditor-date{background:#a1a1a1;color:#fff;font-family:arial,sans-serif;border-radius:3px;display:inline-block;padding:3px;margin:0 3px}div.jsoneditor{color:#1a1a1a;border:1px solid #3883fa;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;width:100%;height:100%;position:relative;padding:0;line-height:100%}div.jsoneditor-tree table.jsoneditor-tree{border-collapse:collapse;border-spacing:0;width:100%}div.jsoneditor-tree div.jsoneditor-tree-inner{padding-bottom:300px}div.jsoneditor-outer{position:static;width:100%;height:100%;margin:-35px 0 0 0;padding:35px 0 0 0;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}div.jsoneditor-outer.has-nav-bar{margin:-61px 0 0 0;padding:61px 0 0 0}div.jsoneditor-outer.has-status-bar{margin:-35px 0 -26px 0;padding:35px 0 26px 0}.ace-jsoneditor,textarea.jsoneditor-text{min-height:150px}div.jsoneditor-tree{width:100%;height:100%;position:relative;overflow:auto}textarea.jsoneditor-text{width:100%;height:100%;margin:0;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;outline-width:0;border:none;background-color:#fff;resize:none}tr.jsoneditor-highlight,tr.jsoneditor-selected{background-color:#d3d3d3}tr.jsoneditor-selected button.jsoneditor-contextmenu,tr.jsoneditor-selected button.jsoneditor-dragarea{visibility:hidden}tr.jsoneditor-selected.jsoneditor-first button.jsoneditor-contextmenu,tr.jsoneditor-selected.jsoneditor-first button.jsoneditor-dragarea{visibility:visible}div.jsoneditor-tree button.jsoneditor-dragarea{background:url(img/jsoneditor-icons.svg) -72px -72px;cursor:move}div.jsoneditor-tree button.jsoneditor-dragarea:focus,div.jsoneditor-tree button.jsoneditor-dragarea:hover,tr.jsoneditor-selected.jsoneditor-first button.jsoneditor-dragarea{background-position:-72px -48px}div.jsoneditor td,div.jsoneditor th,div.jsoneditor tr{padding:0;margin:0}div.jsoneditor td{vertical-align:top}div.jsoneditor td.jsoneditor-tree{vertical-align:top}.jsoneditor-schema-error,div.jsoneditor td,div.jsoneditor textarea,div.jsoneditor th,div.jsoneditor-field,div.jsoneditor-value{font-family:"dejavu sans mono","droid sans mono",consolas,monaco,"lucida console","courier new",courier,monospace,sans-serif;font-size:10pt;color:#1a1a1a}.jsoneditor-schema-error{cursor:default;display:inline-block;height:24px;line-height:24px;position:relative;text-align:center;width:24px}div.jsoneditor-tree .jsoneditor-button.jsoneditor-schema-error{width:24px;height:24px;padding:0;margin:0 4px 0 0;background:url(img/jsoneditor-icons.svg) -168px -48px}'+
    '.jsoneditor-schema-error .jsoneditor-popover{background-color:#4c4c4c;border-radius:3px;box-shadow:0 0 5px rgba(0,0,0,.4);color:#fff;display:none;padding:7px 10px;position:absolute;width:200px;z-index:4}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-above{bottom:32px;left:-98px}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-below{top:32px;left:-98px}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-left{top:-7px;right:32px}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-right{top:-7px;left:32px}.jsoneditor-schema-error .jsoneditor-popover:before{border-right:7px solid transparent;border-left:7px solid transparent;content:"";display:block;left:50%;margin-left:-7px;position:absolute}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-above:before{border-top:7px solid #4c4c4c;bottom:-7px}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-below:before{border-bottom:7px solid #4c4c4c;top:-7px}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-left:before{border-left:7px solid #4c4c4c;border-top:7px solid transparent;border-bottom:7px solid transparent;content:"";top:19px;right:-14px;left:inherit;margin-left:inherit;margin-top:-7px;position:absolute}.jsoneditor-schema-error .jsoneditor-popover.jsoneditor-right:before{border-right:7px solid #4c4c4c;border-top:7px solid transparent;border-bottom:7px solid transparent;content:"";top:19px;left:-14px;margin-left:inherit;margin-top:-7px;position:absolute}.jsoneditor-schema-error:focus .jsoneditor-popover,.jsoneditor-schema-error:hover .jsoneditor-popover{display:block;-webkit-animation:fade-in .3s linear 1,move-up .3s linear 1;-moz-animation:fade-in .3s linear 1,move-up .3s linear 1;-ms-animation:fade-in .3s linear 1,move-up .3s linear 1}@-webkit-keyframes fade-in{from{opacity:0}to{opacity:1}}@-moz-keyframes fade-in{from{opacity:0}to{opacity:1}}@-ms-keyframes fade-in{from{opacity:0}to{opacity:1}}.jsoneditor .jsoneditor-validation-errors-container{max-height:130px;overflow-y:auto}.jsoneditor .jsoneditor-additional-errors{position:absolute;margin:auto;bottom:31px;left:calc(50% - 92px);color:grey;background-color:#ebebeb;padding:7px 15px;border-radius:8px}.jsoneditor .jsoneditor-additional-errors.visible{visibility:visible;opacity:1;transition:opacity 2s linear}.jsoneditor .jsoneditor-additional-errors.hidden{visibility:hidden;opacity:0;transition:visibility 0s 2s,opacity 2s linear}.jsoneditor .jsoneditor-text-errors{width:100%;border-collapse:collapse;background-color:#ffef8b;border-top:1px solid gold}.jsoneditor .jsoneditor-text-errors td{padding:3px 6px;vertical-align:middle}.jsoneditor-text-errors .jsoneditor-schema-error{border:none;width:24px;height:24px;padding:0;margin:0 4px 0 0;background:url(img/jsoneditor-icons.svg) -168px -48px}.fadein{-webkit-animation:fadein .3s;animation:fadein .3s;-moz-animation:fadein .3s;-o-animation:fadein .3s}@-webkit-keyframes fadein{0%{opacity:0}100%{opacity:1}}@-moz-keyframes fadein{0%{opacity:0}100%{opacity:1}}@keyframes fadein{0%{opacity:0}100%{opacity:1}}@-o-keyframes fadein{0%{opacity:0}100%{opacity:1}}div.jsoneditor-contextmenu-root{position:relative;width:0;height:0}div.jsoneditor-contextmenu{position:absolute;box-sizing:content-box;z-index:99999}div.jsoneditor-contextmenu li,div.jsoneditor-contextmenu ul{box-sizing:content-box;position:relative}div.jsoneditor-contextmenu ul{position:relative;left:0;top:0;width:128px;background:#fff;border:1px solid #d3d3d3;box-shadow:2px 2px 12px rgba(128,128,128,.3);list-style:none;margin:0;padding:0}div.jsoneditor-contextmenu ul li button{position:relative;padding:0 4px 0 0;margin:0;width:128px;height:auto;border:none;cursor:pointer;color:#4d4d4d;background:0 0;font-size:10pt;font-family:arial,sans-serif;box-sizing:border-box;text-align:left}div.jsoneditor-contextmenu ul li button::-moz-focus-inner{padding:0;border:0}div.jsoneditor-contextmenu ul li button:focus,div.jsoneditor-contextmenu ul li button:hover{color:#1a1a1a;background-color:#f5f5f5;outline:0}div.jsoneditor-contextmenu ul li button.jsoneditor-default{width:96px}div.jsoneditor-contextmenu ul li button.jsoneditor-expand{float:right;width:32px;height:24px;border-left:1px solid #e5e5e5}div.jsoneditor-contextmenu div.jsoneditor-icon{position:absolute;top:0;left:0;width:24px;height:24px;border:none;padding:0;margin:0;background-image:url(img/jsoneditor-icons.svg)}div.jsoneditor-contextmenu ul li ul div.jsoneditor-icon{margin-left:24px}div.jsoneditor-contextmenu div.jsoneditor-text{padding:4px 0 4px 24px;word-wrap:break-word}div.jsoneditor-contextmenu div.jsoneditor-text.jsoneditor-right-margin{padding-right:24px}div.jsoneditor-contextmenu ul li button div.jsoneditor-expand{position:absolute;top:0;right:0;width:24px;height:24px;padding:0;margin:0 4px 0 0;background:url(img/jsoneditor-icons.svg) 0 -72px}div.jsoneditor-contextmenu div.jsoneditor-separator{height:0;border-top:1px solid #e5e5e5;padding-top:5px;margin-top:5px}div.jsoneditor-contextmenu button.jsoneditor-remove>div.jsoneditor-icon{background-position:-24px 0}div.jsoneditor-contextmenu button.jsoneditor-append>div.jsoneditor-icon{background-position:0 0}div.jsoneditor-contextmenu button.jsoneditor-insert>div.jsoneditor-icon{background-position:0 0}div.jsoneditor-contextmenu button.jsoneditor-duplicate>div.jsoneditor-icon{background-position:-48px 0}div.jsoneditor-contextmenu button.jsoneditor-sort-asc>div.jsoneditor-icon{background-position:-168px 0}div.jsoneditor-contextmenu button.jsoneditor-sort-desc>div.jsoneditor-icon{background-position:-192px 0}div.jsoneditor-contextmenu button.jsoneditor-transform>div.jsoneditor-icon{background-position:-216px 0}div.jsoneditor-contextmenu ul li button.jsoneditor-selected,div.jsoneditor-contextmenu ul li button.jsoneditor-selected:focus,div.jsoneditor-contextmenu ul li button.jsoneditor-selected:hover{color:#fff;background-color:#ee422e}div.jsoneditor-contextmenu ul li{overflow:hidden}div.jsoneditor-contextmenu ul li ul{display:none;position:relative;left:-10px;top:0;border:none;box-shadow:inset 0 0 10px rgba(128,128,128,.5);padding:0 10px;-webkit-transition:all .3s ease-out;-moz-transition:all .3s ease-out;-o-transition:all .3s ease-out;transition:all .3s ease-out}div.jsoneditor-contextmenu ul li ul li button{padding-left:24px;animation:all ease-in-out 1s}div.jsoneditor-contextmenu ul li ul li button:focus,div.jsoneditor-contextmenu ul li ul li button:hover{background-color:#f5f5f5}div.jsoneditor-contextmenu button.jsoneditor-type-string>div.jsoneditor-icon{background-position:-144px 0}div.jsoneditor-contextmenu button.jsoneditor-type-auto>div.jsoneditor-icon{background-position:-120px 0}div.jsoneditor-contextmenu button.jsoneditor-type-object>div.jsoneditor-icon{background-position:-72px 0}div.jsoneditor-contextmenu button.jsoneditor-type-array>div.jsoneditor-icon{background-position:-96px 0}div.jsoneditor-contextmenu button.jsoneditor-type-modes>div.jsoneditor-icon{background-image:none;width:6px}.jsoneditor-modal-overlay{position:absolute!important;background:#010101!important;opacity:.3!important}.jsoneditor-modal{position:absolute!important;max-width:95%!important;width:auto!important;border-radius:2px!important;padding:45px 15px 15px 15px!important;box-shadow:2px 2px 12px rgba(128,128,128,.3)!important;color:#4d4d4d;line-height:1.3em}.jsoneditor-modal.jsoneditor-modal-transform{width:600px!important}.jsoneditor-modal .pico-modal-header{position:absolute;box-sizing:border-box;top:0;left:0;width:100%;padding:0 10px;height:30px;line-height:30px;font-family:arial,sans-serif;font-size:11pt;background:#3883fa;color:#fff}.jsoneditor-modal table{width:100%}.jsoneditor-modal table td,.jsoneditor-modal table th{padding:5px 20px 5px 0;text-align:left;vertical-align:top;font-weight:400;color:#4d4d4d;line-height:32px}.jsoneditor-modal p:first-child{margin-top:0}.jsoneditor-modal a{color:#3883fa}.jsoneditor-modal table td.jsoneditor-modal-input{text-align:right;padding-right:0;white-space:nowrap}.jsoneditor-modal table td.jsoneditor-modal-actions{padding-top:15px}.jsoneditor-modal .pico-close{background:0 0!important;font-size:24px!important;top:7px!important;right:7px!important;color:#fff}.jsoneditor-modal #query,.jsoneditor-modal input,.jsoneditor-modal select,.jsoneditor-modal textarea{background:#fff;border:1px solid #d3d3d3;color:#4d4d4d;border-radius:3px;padding:4px}.jsoneditor-modal,.jsoneditor-modal #query,.jsoneditor-modal input,.jsoneditor-modal option,.jsoneditor-modal select,.jsoneditor-modal table td,.jsoneditor-modal table th,.jsoneditor-modal textarea{font-size:10.5pt;font-family:arial,sans-serif}.jsoneditor-modal #query,.jsoneditor-modal .jsoneditor-transform-preview{font-family:"dejavu sans mono","droid sans mono",consolas,monaco,"lucida console","courier new",courier,monospace,sans-serif;font-size:10pt}.jsoneditor-modal input[type=button],.jsoneditor-modal input[type=submit]{background:#f5f5f5;padding:4px 20px}.jsoneditor-modal input,.jsoneditor-modal select{cursor:pointer}.jsoneditor-modal input{padding:4px}.jsoneditor-modal input[type=text]{cursor:inherit}.jsoneditor-modal input[disabled]{background:#d3d3d3;color:grey}.jsoneditor-modal .jsoneditor-select-wrapper{position:relative;display:inline-block}.jsoneditor-modal .jsoneditor-select-wrapper:after{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #666;position:absolute;right:8px;top:14px;pointer-events:none}.jsoneditor-modal select{padding:3px 24px 3px 10px;min-width:180px;max-width:350px;-webkit-appearance:none;-moz-appearance:none;appearance:none;text-indent:0;text-overflow:"";font-size:10pt;line-height:1.5em}.jsoneditor-modal select::-ms-expand{display:none}.jsoneditor-modal .jsoneditor-button-group input{padding:4px 10px;margin:0;border-radius:0;border-left-style:none}.jsoneditor-modal .jsoneditor-button-group input.jsoneditor-button-first{border-top-left-radius:3px;border-bottom-left-radius:3px;border-left-style:solid}.jsoneditor-modal .jsoneditor-button-group input.jsoneditor-button-last{border-top-right-radius:3px;border-bottom-right-radius:3px}.jsoneditor-modal .jsoneditor-button-group.jsoneditor-button-group-value-asc input.jsoneditor-button-asc,.jsoneditor-modal .jsoneditor-button-group.jsoneditor-button-group-value-desc input.jsoneditor-button-desc{background:#3883fa;border-color:#3883fa;color:#fff}.jsoneditor-modal #query,.jsoneditor-modal .jsoneditor-transform-preview{width:100%;box-sizing:border-box}.jsoneditor-modal .jsoneditor-transform-preview{background:#f5f5f5;height:200px}.jsoneditor-modal .jsoneditor-transform-preview.jsoneditor-error{color:#ee422e}.jsoneditor-modal .jsoneditor-jmespath-wizard{line-height:1.2em;width:100%;background:#ffffe0;border:1px solid #ffe99a;padding:0 10px 10px;border-radius:3px}.jsoneditor-modal .jsoneditor-jmespath-wizard-label{font-style:italic;margin:4px 0 2px 0}.jsoneditor-modal .jsoneditor-inline{position:relative;display:inline-block;width:100%;padding:2px}.jsoneditor-modal .jsoneditor-jmespath-filter{display:flex;flex-wrap:wrap}.jsoneditor-modal .jsoneditor-jmespath-filter-field{width:170px}.jsoneditor-modal .jsoneditor-jmespath-filter-relation{width:100px}.jsoneditor-modal .jsoneditor-jmespath-filter-value{min-width:100px;flex:1}.jsoneditor-modal .jsoneditor-jmespath-sort-field{width:170px}.jsoneditor-modal .jsoneditor-jmespath-sort-order{width:150px}.jsoneditor-modal .jsoneditor-jmespath-select-fields{width:100%}.jsoneditor-modal .selectr-selected{border-color:#d3d3d3;padding:4px 28px 4px 8px}.jsoneditor-modal .selectr-selected .selectr-tag{background-color:#3883fa;border-radius:5px}div.jsoneditor-menu{width:100%;height:35px;padding:2px;margin:0;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;color:#fff;background-color:#3883fa;border-bottom:1px solid #3883fa}div.jsoneditor-menu>button,div.jsoneditor-menu>div.jsoneditor-modes>button{width:26px;height:26px;margin:2px;padding:0;border-radius:2px;border:1px solid transparent;background:transparent url(img/jsoneditor-icons.svg);color:#fff;opacity:.8;font-family:arial,sans-serif;font-size:10pt;float:left}div.jsoneditor-menu>button:hover,div.jsoneditor-menu>div.jsoneditor-modes>button:hover{background-color:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4)}div.jsoneditor-menu>button:active,div.jsoneditor-menu>button:focus,div.jsoneditor-menu>div.jsoneditor-modes>button:active,div.jsoneditor-menu>div.jsoneditor-modes>button:focus{background-color:rgba(255,255,255,.3)}div.jsoneditor-menu>button:disabled,div.jsoneditor-menu>div.jsoneditor-modes>button:disabled{opacity:.5}div.jsoneditor-menu>button.jsoneditor-collapse-all{background-position:0 -96px}div.jsoneditor-menu>button.jsoneditor-expand-all{background-position:0 -120px}div.jsoneditor-menu>button.jsoneditor-sort{background-position:-120px -96px}div.jsoneditor-menu>button.jsoneditor-transform{background-position:-144px -96px}div.jsoneditor.jsoneditor-mode-form>div.jsoneditor-menu>button.jsoneditor-sort,div.jsoneditor.jsoneditor-mode-form>div.jsoneditor-menu>button.jsoneditor-transform,div.jsoneditor.jsoneditor-mode-view>div.jsoneditor-menu>button.jsoneditor-sort,div.jsoneditor.jsoneditor-mode-view>div.jsoneditor-menu>button.jsoneditor-transform{display:none}div.jsoneditor-menu>button.jsoneditor-undo{background-position:-24px -96px}div.jsoneditor-menu>button.jsoneditor-undo:disabled{background-position:-24px -120px}div.jsoneditor-menu>button.jsoneditor-redo{background-position:-48px -96px}div.jsoneditor-menu>button.jsoneditor-redo:disabled{background-position:-48px -120px}div.jsoneditor-menu>button.jsoneditor-compact{background-position:-72px -96px}' +
    'div.jsoneditor-menu>button.jsoneditor-format{background-position:-72px -120px}div.jsoneditor-menu>button.jsoneditor-repair{background-position:-96px -96px}div.jsoneditor-menu>div.jsoneditor-modes{display:inline-block;float:left}div.jsoneditor-menu>div.jsoneditor-modes>button{background-image:none;width:auto;padding-left:6px;padding-right:6px}div.jsoneditor-menu>button.jsoneditor-separator,div.jsoneditor-menu>div.jsoneditor-modes>button.jsoneditor-separator{margin-left:10px}div.jsoneditor-menu a{font-family:arial,sans-serif;font-size:10pt;color:#fff;opacity:.8;vertical-align:middle}div.jsoneditor-menu a:hover{opacity:1}div.jsoneditor-menu a.jsoneditor-poweredBy{font-size:8pt;position:absolute;right:0;top:0;padding:10px}table.jsoneditor-search div.jsoneditor-results,table.jsoneditor-search input{font-family:arial,sans-serif;font-size:10pt;color:#1a1a1a;background:0 0}table.jsoneditor-search div.jsoneditor-results{color:#fff;padding-right:5px;line-height:24px;padding-top:2px}table.jsoneditor-search{position:absolute;right:4px;top:4px;border-collapse:collapse;border-spacing:0}table.jsoneditor-search div.jsoneditor-frame{border:1px solid transparent;background-color:#fff;padding:0 2px;margin:0}table.jsoneditor-search div.jsoneditor-frame table{border-collapse:collapse}table.jsoneditor-search input{width:120px;border:none;outline:0;margin:1px;line-height:20px}table.jsoneditor-search button{width:16px;height:24px;padding:0;margin:0;border:none;background:url(img/jsoneditor-icons.svg);vertical-align:top}table.jsoneditor-search button:hover{background-color:transparent}table.jsoneditor-search button.jsoneditor-refresh{width:18px;background-position:-99px -73px}table.jsoneditor-search button.jsoneditor-next{cursor:pointer;background-position:-124px -73px}table.jsoneditor-search button.jsoneditor-next:hover{background-position:-124px -49px}table.jsoneditor-search button.jsoneditor-previous{cursor:pointer;background-position:-148px -73px;margin-right:2px}table.jsoneditor-search button.jsoneditor-previous:hover{background-position:-148px -49px}div.jsoneditor div.autocomplete.dropdown{position:absolute;background:#fff;box-shadow:2px 2px 12px rgba(128,128,128,.3);border:1px solid #d3d3d3;z-index:100;overflow-x:hidden;overflow-y:auto;cursor:default;margin:0;padding-left:2pt;padding-right:5pt;text-align:left;outline:0;font-family:"dejavu sans mono","droid sans mono",consolas,monaco,"lucida console","courier new",courier,monospace,sans-serif;font-size:10pt}div.jsoneditor div.autocomplete.dropdown .item{color:#333}div.jsoneditor div.autocomplete.dropdown .item.hover{background-color:#ddd}div.jsoneditor div.autocomplete.hint{color:#aaa;top:4px;left:4px}div.jsoneditor-treepath{padding:0 5px;overflow:hidden}div.jsoneditor-treepath div.jsoneditor-contextmenu-root{position:absolute;left:0}div.jsoneditor-treepath span.jsoneditor-treepath-element{margin:1px;font-family:arial,sans-serif;font-size:10pt}div.jsoneditor-treepath span.jsoneditor-treepath-seperator{margin:2px;font-size:9pt;font-family:arial,sans-serif}div.jsoneditor-treepath span.jsoneditor-treepath-element:hover,div.jsoneditor-treepath span.jsoneditor-treepath-seperator:hover{cursor:pointer;text-decoration:underline}div.jsoneditor-statusbar{line-height:26px;height:26px;margin-top:-1px;color:grey;background-color:#ebebeb;border-top:1px solid #d3d3d3;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;font-size:10pt}div.jsoneditor-statusbar>.jsoneditor-curserinfo-label{margin:0 2px 0 4px}div.jsoneditor-statusbar>.jsoneditor-curserinfo-val{margin-right:12px}div.jsoneditor-statusbar>.jsoneditor-curserinfo-count{margin-left:4px}div.jsoneditor-statusbar>.jsoneditor-validation-error-icon{float:right;width:24px;height:24px;padding:0;margin-top:1px;background:url(img/jsoneditor-icons.svg) -168px -48px}div.jsoneditor-statusbar>.jsoneditor-validation-error-count{float:right;margin:0 4px 0 0}div.jsoneditor-navigation-bar{width:100%;height:26px;line-height:26px;padding:0;margin:0;border-bottom:1px solid #d3d3d3;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;color:grey;background-color:#ebebeb;overflow:hidden;font-family:arial,sans-serif;font-size:10pt}.selectr-container{position:relative}.selectr-container li{list-style:none}.selectr-hidden{position:absolute;overflow:hidden;clip:rect(0,0,0,0);width:1px;height:1px;margin:-1px;padding:0;border:0 none}.selectr-visible{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;z-index:11}.selectr-desktop.multiple .selectr-visible{display:none}.selectr-desktop.multiple.native-open .selectr-visible{top:100%;min-height:200px!important;height:auto;opacity:1;display:block}.selectr-container.multiple.selectr-mobile .selectr-selected{z-index:0}.selectr-selected{position:relative;z-index:1;box-sizing:border-box;width:100%;padding:7px 28px 7px 14px;cursor:pointer;border:1px solid #999;border-radius:3px;background-color:#fff}.selectr-selected::before{position:absolute;top:50%;right:10px;width:0;height:0;content:"";-o-transform:rotate(0) translate3d(0,-50%,0);-ms-transform:rotate(0) translate3d(0,-50%,0);-moz-transform:rotate(0) translate3d(0,-50%,0);-webkit-transform:rotate(0) translate3d(0,-50%,0);transform:rotate(0) translate3d(0,-50%,0);border-width:4px 4px 0 4px;border-style:solid;border-color:#6c7a86 transparent transparent}.selectr-container.native-open .selectr-selected::before,.selectr-container.open .selectr-selected::before{border-width:0 4px 4px 4px;border-style:solid;border-color:transparent transparent #6c7a86}.selectr-label{display:none;overflow:hidden;width:100%;white-space:nowrap;text-overflow:ellipsis}.selectr-placeholder{color:#6c7a86}.selectr-tags{margin:0;padding:0;white-space:normal}.has-selected .selectr-tags{margin:0 0 -2px}.selectr-tag{list-style:none;position:relative;float:left;padding:2px 25px 2px 8px;margin:0 2px 2px 0;cursor:default;color:#fff;border:medium none;border-radius:10px;background:#acb7bf none repeat scroll 0 0}.selectr-container.multiple.has-selected .selectr-selected{padding:5px 28px 5px 5px}.selectr-options-container{position:absolute;z-index:10000;top:calc(100% - 1px);left:0;display:none;box-sizing:border-box;width:100%;border-width:0 1px 1px;border-style:solid;border-color:transparent #999 #999;border-radius:0 0 3px 3px;background-color:#fff}.selectr-container.open .selectr-options-container{display:block}.selectr-input-container{position:relative;display:none}.selectr-clear,.selectr-input-clear,.selectr-tag-remove{position:absolute;top:50%;right:22px;width:20px;height:20px;padding:0;cursor:pointer;-o-transform:translate3d(0,-50%,0);-ms-transform:translate3d(0,-50%,0);-moz-transform:translate3d(0,-50%,0);-webkit-transform:translate3d(0,-50%,0);transform:translate3d(0,-50%,0);border:medium none;background-color:transparent;z-index:11}.selectr-clear,.selectr-input-clear{display:none}.selectr-container.has-selected .selectr-clear,.selectr-input-container.active .selectr-input-clear{display:block}.selectr-selected .selectr-tag-remove{right:2px}.selectr-clear::after,.selectr-clear::before,.selectr-input-clear::after,.selectr-input-clear::before,.selectr-tag-remove::after,.selectr-tag-remove::before{position:absolute;top:5px;left:9px;width:2px;height:10px;content:" ";background-color:#6c7a86}.selectr-tag-remove::after,.selectr-tag-remove::before{top:4px;width:3px;height:12px;background-color:#fff}.selectr-clear:before,.selectr-input-clear::before,.selectr-tag-remove::before{-o-transform:rotate(45deg);-ms-transform:rotate(45deg);-moz-transform:rotate(45deg);-webkit-transform:rotate(45deg);transform:rotate(45deg)}.selectr-clear:after,.selectr-input-clear::after,.selectr-tag-remove::after{-o-transform:rotate(-45deg);-ms-transform:rotate(-45deg);-moz-transform:rotate(-45deg);-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}.selectr-input-container.active,.selectr-input-container.active .selectr-clear{display:block}.selectr-input{top:5px;left:5px;box-sizing:border-box;width:calc(100% - 30px);margin:10px 15px;padding:7px 30px 7px 9px;border:1px solid #999;border-radius:3px}.selectr-notice{display:none;box-sizing:border-box;width:100%;padding:8px 16px;border-top:1px solid #999;border-radius:0 0 3px 3px;background-color:#fff}.selectr-container.notice .selectr-notice{display:block}.selectr-container.notice .selectr-selected{border-radius:3px 3px 0 0}.selectr-options{position:relative;top:calc(100% + 2px);display:none;overflow-x:auto;overflow-y:scroll;max-height:200px;margin:0;padding:0}.selectr-container.notice .selectr-options-container,.selectr-container.open .selectr-input-container,.selectr-container.open .selectr-options{display:block}.selectr-option{position:relative;display:block;padding:5px 20px;list-style:outside none none;cursor:pointer;font-weight:400}.selectr-options.optgroups>.selectr-option{padding-left:25px}.selectr-optgroup{font-weight:700;padding:0}.selectr-optgroup--label{font-weight:700;margin-top:10px;padding:5px 15px}.selectr-match{text-decoration:underline}.selectr-option.selected{background-color:#ddd}.selectr-option.active{color:#fff;background-color:#5897fb}.selectr-option.disabled{opacity:.4}.selectr-option.excluded{display:none}.selectr-container.open .selectr-selected{border-color:#999 #999 transparent #999;border-radius:3px 3px 0 0}.selectr-container.open .selectr-selected::after{-o-transform:rotate(180deg) translate3d(0,50%,0);-ms-transform:rotate(180deg) translate3d(0,50%,0);-moz-transform:rotate(180deg) translate3d(0,50%,0);-webkit-transform:rotate(180deg) translate3d(0,50%,0);transform:rotate(180deg) translate3d(0,50%,0)}.selectr-disabled{opacity:.6}.has-selected .selectr-placeholder,.selectr-empty{display:none}.has-selected .selectr-label{display:block}.taggable .selectr-selected{padding:4px 28px 4px 4px}.taggable .selectr-selected::after{display:table;content:" ";clear:both}.taggable .selectr-label{width:auto}.taggable .selectr-tags{float:left;display:block}.taggable .selectr-placeholder{display:none}.input-tag{float:left;min-width:90px;width:auto}.selectr-tag-input{border:medium none;padding:3px 10px;width:100%;font-family:inherit;font-weight:inherit;font-size:inherit}.selectr-input-container.loading::after{position:absolute;top:50%;right:20px;width:20px;height:20px;content:"";-o-transform:translate3d(0,-50%,0);-ms-transform:translate3d(0,-50%,0);-moz-transform:translate3d(0,-50%,0);-webkit-transform:translate3d(0,-50%,0);transform:translate3d(0,-50%,0);-o-transform-origin:50% 0 0;-ms-transform-origin:50% 0 0;-moz-transform-origin:50% 0 0;-webkit-transform-origin:50% 0 0;transform-origin:50% 0 0;-moz-animation:.5s linear 0s normal forwards infinite running spin;-webkit-animation:.5s linear 0s normal forwards infinite running spin;animation:.5s linear 0s normal forwards infinite running spin;border-width:3px;border-style:solid;border-color:#aaa #ddd #ddd;border-radius:50%}@-webkit-keyframes spin{0%{-webkit-transform:rotate(0) translate3d(0,-50%,0);transform:rotate(0) translate3d(0,-50%,0)}100%{-webkit-transform:rotate(360deg) translate3d(0,-50%,0);transform:rotate(360deg) translate3d(0,-50%,0)}}@keyframes spin{0%{-webkit-transform:rotate(0) translate3d(0,-50%,0);transform:rotate(0) translate3d(0,-50%,0)}100%{-webkit-transform:rotate(360deg) translate3d(0,-50%,0);transform:rotate(360deg) translate3d(0,-50%,0)}}.selectr-container.open.inverted .selectr-selected{border-color:transparent #999 #999;border-radius:0 0 3px 3px}.selectr-container.inverted .selectr-options-container{border-width:1px 1px 0;border-color:#999 #999 transparent;border-radius:3px 3px 0 0;background-color:#fff}.selectr-container.inverted .selectr-options-container{top:auto;bottom:calc(100% - 1px)}.selectr-container ::-webkit-input-placeholder{color:#6c7a86;opacity:1}.selectr-container ::-moz-placeholder{color:#6c7a86;opacity:1}.selectr-container :-ms-input-placeholder{color:#6c7a86;opacity:1}.selectr-container ::placeholder{color:#6c7a86;opacity:1}';
  }

