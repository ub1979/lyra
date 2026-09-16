/** Explain the explicit restart boundary for editing a saved connection. */
export function ProviderAddressNotice() {
  return (
    <p className="text-xs text-text-secondary" role="note" aria-label="Provider address changes">
      If you edit a saved provider’s server address, finish or stop active work,
      then restart the Lyra backend and reopen your conversation to use the new
      address. Ordinary model selection does not require this restart.
    </p>
  );
}
