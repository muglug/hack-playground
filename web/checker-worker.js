try {
  const {default: init} = await import('./pkg/hack_playground.mjs');
  const wasm = await init();
  const encoder = new TextEncoder();
  self.onmessage = ({data: {version, code}}) => {
    const input = encoder.encode(code);
    if (input.length > 100000) {
      self.postMessage({type: 'error', version, message: 'Hack source exceeds 100,000 bytes.'});
      return;
    }
    try {
      const response = JSON.parse(
        wasm.ccall('check_hack', 'string', ['array', 'number'], [input, input.length])
      );
      if ('Err' in response) throw new Error(response.Err);
      self.postMessage({type: 'result', version, diagnostics: response.Ok});
    } catch (error) {
      self.postMessage({type: 'failed', message: String(error)});
    }
  };
  self.postMessage({type: 'ready'});
} catch (error) {
  self.postMessage({type: 'failed', message: 'Could not load the Hack typechecker. ' + error});
}
