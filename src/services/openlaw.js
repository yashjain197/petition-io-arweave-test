  // src/services/openlaw.js
  import { APIClient, Openlaw } from 'openlaw';
  import { OPENLAW_BASE_URL, OPENLAW_EMAIL, OPENLAW_PASSWORD } from '../config/constants';

  let client;
  export async function getOpenLawClient(){
    if (client) return client;
    client = new APIClient(OPENLAW_BASE_URL);
    await client.login(OPENLAW_EMAIL, OPENLAW_PASSWORD);
    return client;
  }

  export async function compileTemplate(template, parameters){
    const compiled = await Openlaw.compileTemplate(template);
    const { executionResult, errorMessage } = Openlaw.execute(compiled, parameters);
    if (errorMessage) throw new Error(errorMessage);
    return { compiled, executionResult };
  }

  export async function exportDocument(executionResult){
    // The OpenLaw API can render/export a doc/PDF server-side if your account allows.
    // Here we request HTML, then you can print-to-PDF client-side or call dedicated export.
    const html = await Openlaw.renderForReview({ executionResult });
    const blob = new Blob([html], { type: 'text/html' });
    return blob; // you can pipe to iframe or download
  }
