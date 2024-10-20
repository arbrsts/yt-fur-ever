import { useState } from 'react'
import './App.css'
import { Input, Label, TextField } from 'react-aria-components'


function App() {
  const [command, setCommand] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const output = await ipcRenderer.invoke('run-command', command);
      setResult(output);
    } catch (error) {
      setResult(`Error: ${error}`);
    }
  };




  return (
    <>
      {result}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter shell command"
        />
        <button type="submit">Execute</button>
      </form>
    </>
  )
}

export default App
