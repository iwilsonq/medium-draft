import 'draft-js/dist/Draft.css';
import './index.scss';
import './components/blocks/text.scss';

import React from 'react';
import {
  Editor,
  EditorState,
  SelectionState,
  ContentState,
  RichUtils,
  convertToRaw,
  convertFromRaw,
  CompositeDecorator,
  Entity,
} from 'draft-js';

import AddButton from 'components/addbutton';
import Toolbar from 'components/toolbar';

import rendererFn from 'components/customrenderer';
import { getSelectionRect, getSelection } from 'util';
import keyBindingFn from 'util/keybinding';
import beforeInput, { StringToTypeMap } from 'util/beforeinput';
import { getCurrentBlock, addNewBlock } from 'model';
import Link, { findLinkEntities } from 'components/entities/link';

const styleMap = {
   'HIGHLIGHT': {
      backgroundColor: 'yellow',
   },
   'CODE': {
      background: '#DEDEDE',
      // padding: '0 5px',
      borderRadius: 2,
      fontFamily: 'monospace',
      wordWrap: 'break-word'
   }
};

function getBlockStyle(block) {
  switch (block.getType()) {
    case 'blockquote': return 'block block-quote RichEditor-blockquote';
    case 'unstyled': return 'block block-paragraph';
    default: return null;
  }
}

class MyEditor extends React.Component {

  constructor(props) {
    super(props);

    const decorator = new CompositeDecorator([
      {
        strategy: findLinkEntities,
        component: Link,
      },
    ]);
    this.state = {
      editorState: EditorState.createEmpty(decorator),
      showURLInput: false,
      editorEnabled: true,
      urlValue: ''
    };
    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => {
      window.editorState = editorState;
      this.setState({editorState});
    };

    this.onClick = () => {
      if (!this.state.editorEnabled) {
        this.setState({
          editorEnabled: true
        }, () => {
          this.focus();
        });
      }
    };

    this.logData = this.logData.bind(this);
    this.onClick = this.onClick.bind(this);
    this.handleKeyCommand = this.handleKeyCommand.bind(this);
    this.handleBeforeInput = this.handleBeforeInput.bind(this);
    this.toggleBlockType = this._toggleBlockType.bind(this);
    this.toggleInlineStyle = this._toggleInlineStyle.bind(this);
    this.toggleEdit = this.toggleEdit.bind(this);
    this.loadSavedData = this.loadSavedData.bind(this);
    this.setLink = this.setLink.bind(this);
  }

  componentDidMount() {
    this.focus();
  }

  logData(e) {
    console.log(convertToRaw(this.state.editorState.getCurrentContent()));
    console.log(this.state.editorState.getSelection().toJS());
    window.sel = this.state.editorState.getSelection();
  }

  setLink(url) {
    const { editorState } = this.state;
    const selection = editorState.getSelection();
    let entityKey = null;
    if (url !== '') {
      entityKey = Entity.create('LINK', 'MUTABLE', { url });
    }
    this.setState({
      editorState: RichUtils.toggleLink(
        editorState,
        selection,
        entityKey
      ),
    }, () => {
      setTimeout(() => this.refs.editor.focus(), 0);
    });
  }

  handleDroppedFiles(selection, files) {
    console.log(selection.toJS());
    console.log(files);
  }

  handleKeyCommand(command) {
    // console.log(command);
    if (command === 'editor-save') {
      window.localStorage['editor'] = JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent()));
      window.localStorage['tmp'] = JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent()));
      return true;
    } else if (command === 'showlinkinput') {
      if (this.refs.toolbar) {
        this.refs.toolbar.showLinkInput(null, true);
      }
      return true;
    } else if (command === 'add-new-block') {
      const { editorState } = this.state;
      this.onChange(addNewBlock(editorState, 'blockquote'));
      return true;
    } else if (command === 'load-saved-data') {
      this.loadSavedData();
      return true;
    }
    const { editorState } = this.state;
    const block = getCurrentBlock(editorState);
    if (command.indexOf('changetype:') == 0) {
      let newBlockType = command.split(':')[1];
      const currentBlockType = block.getType();
      if (currentBlockType == 'atomic' || currentBlockType == 'media') {
        return false;
      }
      if (currentBlockType == 'blockquote' && newBlockType == 'caption') {
        newBlockType = 'block-quote-caption';
      } else if (currentBlockType == 'block-quote-caption' && newBlockType == 'caption') {
        newBlockType = 'blockquote';
      }
      this.onChange(RichUtils.toggleBlockType(editorState, newBlockType));
      return true;
    }
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      this.onChange(newState);
      return true;
    }
    return false;
  }

  handleBeforeInput(str) {
    return this.props.beforeInput(this.state.editorState, str, this.onChange, this.props.stringToTypeMap);
  }

  _toggleBlockType(blockType) {
    this.onChange(
      RichUtils.toggleBlockType(
        this.state.editorState,
        blockType
      )
    );
  }

  _toggleInlineStyle(inlineStyle) {
    this.onChange(
      RichUtils.toggleInlineStyle(
        this.state.editorState,
        inlineStyle
      )
    );
  }

  toggleEdit(e) {
    this.setState({
      editorEnabled: !this.state.editorEnabled
    });
  }

  loadSavedData() {
    const data = window.localStorage.getItem('editor');
    if (data === null) {
      console.log('No data found.');
      return;
    }
    try {
      const blockData = JSON.parse(data);
      console.log(blockData);
      this.setState({
        editorState: EditorState.push(
          this.state.editorState,
          ContentState.createFromBlockArray(convertFromRaw(blockData))
        )
      }, () => this.refs.editor.focus());
    } catch(e) {
      console.log(e);
      console.log('Could not load data.');
    }
  }

  render() {
    const { editorState, showURLInput, editorEnabled, urlValue } = this.state;
    // console.log(this.props);
    return (
      <div className="RichEditor-root">
        <div className="RichEditor-editor">
          <Editor
            ref="editor"
            editorState={editorState}
            blockRendererFn={rendererFn}
            blockStyleFn={getBlockStyle}
            onChange={this.onChange}
            handleKeyCommand={this.handleKeyCommand}
            handleBeforeInput={this.handleBeforeInput}
            handleDroppedFiles={this.handleDroppedFiles}
            customStyleMap={styleMap}
            readOnly={!editorEnabled}
            keyBindingFn={keyBindingFn}
            placeholder="Write your story"
            spellCheck={false} />
          { editorEnabled ? <AddButton editorState={editorState} /> : null }
          <Toolbar
            ref="toolbar"
            editorState={editorState}
            toggleBlockType={this.toggleBlockType}
            toggleInlineStyle={this.toggleInlineStyle}
            editorEnabled={editorEnabled}
            setLink={this.setLink}
            focus={this.focus} />
        </div>
        <div className="editor-action">
          <button onClick={this.logData}>Log State</button>
          <button onClick={this.toggleEdit}>Toggle Edit</button>
        </div>
      </div>
    );
  }
}

MyEditor.defaultProps = {
  beforeInput,
  stringToTypeMap: StringToTypeMap
};


export default MyEditor;