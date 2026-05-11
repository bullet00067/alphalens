## Why

In the TACTICAL dashboard, users are seeing a red "SYNC ERROR" label. After investigation, this label is actually triggered by the `verifyWithYahoo` function failing (often due to network blocks on hosting providers like Render) and does NOT indicate that the charts are out of sync. This is misleading and causes unnecessary alarm.

Additionally, there is no actual "Time-Scale Sync" check to verify if the Tactical chart and Main chart are correctly aligned, which is what the "Sync" term should actually refer to.

## What Changes

1. **Rename the Label**: Change the display text for `validationStatus.status === 'ERROR'` from `Sync Error` to `Verify Error` (or `Offline` / `Unverified`) to accurately reflect that it's a data verification failure with Yahoo Finance, not a technical chart sync issue.
2. **Update the Icon**: Use a less alarming icon or color for `Verify Error` if it's just a network timeout.
3. **Implement Real Sync Detection (Optional but Recommended)**: Create a new status check that compares the visible logical ranges of `currentStockChart` and `pipChartInstance`. If they differ significantly, display a *real* `Sync Error`.
4. **Update Sidebar UI**: Ensure the "Data Validity" section in the sidebar correctly reflects this distinction.

## Impact

- `app.js`: Update the template string in `renderTacticalChart` and the logic in `verifyWithYahoo` callers.
