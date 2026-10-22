(() => {
  'use strict';

  const form = document.getElementById('ambassadorApplication');
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('applicationStatus');
  const controls = [...form.elements];
  let sending = false;
  let pendingSubmission = null;

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = false;
  };

  let endpoint;
  try {
    endpoint = new URL(window.ambassadorApplicationConfig?.endpoint);
    if (endpoint.origin !== 'https://script.google.com' ||
        !/^\/macros\/s\/[\w-]+\/exec$/.test(endpoint.pathname) ||
        endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
      throw new Error('Invalid application endpoint');
    }
  } catch {
    showStatus('Applications are temporarily unavailable. Please check back shortly.', 'unavailable');
    form.addEventListener('submit', event => event.preventDefault());
    return;
  }

  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;

    const body = new URLSearchParams(new FormData(form));
    const fingerprint = body.toString();
    // Reuse the receipt on an unchanged retry if the first response was lost.
    if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      pendingSubmission = {
        fingerprint,
        id: [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
      };
    }
    body.set('submissionId', pendingSubmission.id);

    sending = true;
    const disabledStates = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    button.textContent = 'Submitting…';
    showStatus('Sending your application…', 'pending');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      // A URL-encoded POST avoids a CORS preflight. Read the JSON confirmation;
      // never use no-cors, whose opaque response cannot confirm a saved row.
      const response = await fetch(endpoint.href, {
        method: 'POST',
        body,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Submission could not be confirmed');
      const result = await response.json();
      if (result.ok !== true || result.submissionId !== pendingSubmission.id) {
        throw new Error('Submission could not be confirmed');
      }

      form.reset();
      pendingSubmission = null;
      showStatus('Thank you. Your application has been received. Our team will review your details.', 'success');
    } catch {
      showStatus('We couldn’t confirm that your application was saved. Your details are still here. Please try again.', 'error');
    } finally {
      clearTimeout(timeout);
      sending = false;
      controls.forEach((control, index) => { control.disabled = disabledStates[index]; });
      form.removeAttribute('aria-busy');
      button.textContent = 'Submit application';
    }
  });
})();
