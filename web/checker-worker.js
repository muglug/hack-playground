try {
  const {default: init} = await import('./pkg/hack_playground.mjs');
  const wasm = await init();
  const encoder = new TextEncoder();
  self.onmessage = ({data}) => {
    try {
      const input = encoder.encode(data.code);
      if (input.length > 100000) throw new Error('Hack source exceeds 100,000 bytes.');
      const response = JSON.parse(
        wasm.ccall('check_hack', 'string', ['array', 'number'], [input, input.length])
      );
      if ('Err' in response) throw new Error(response.Err);
      const diagnostics = response.Ok;
      if (!Array.isArray(diagnostics)) throw new Error('Invalid diagnostic response');
      self.postMessage({type:'result', diagnostics});
    } catch (error) {
      self.postMessage({type:'error', message:String(error)});
    }
  };
  self.postMessage({type:'ready'});
} catch (error) {
  self.postMessage({type:'unavailable', message:String(error)});
}
