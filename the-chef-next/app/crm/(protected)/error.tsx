"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="crm-panel" role="alert">
      <h2>Unable to load this view.</h2>
      <p>
        Your changes may not have been saved. Check the connection and retry.
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
