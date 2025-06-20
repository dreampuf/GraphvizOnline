// __mocks__/ace.js
const mockEditor = {
  session: {
    setValue: jest.fn(),
    getValue: jest.fn().mockReturnValue(''),
    setMode: jest.fn(),
    on: jest.fn(),
    getDocument: jest.fn().mockReturnValue({
      getValue: jest.fn().mockReturnValue('')
    }),
  },
  setTheme: jest.fn(),
  getValue: jest.fn().mockReturnValue(''),
  setValue: jest.fn(),
  // Add any other methods app.js calls on the editor instance
  // For example, if app.js uses editor.focus(), add:
  // focus: jest.fn(),
};

// Simulating the global 'ace' object
module.exports = {
  edit: jest.fn().mockReturnValue(mockEditor),
};
