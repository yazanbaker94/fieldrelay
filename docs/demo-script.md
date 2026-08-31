# 90-second reviewer script

1. Open `/demo` and start the guided trace.
2. Inspect `FR-2026-0842` saved on Maya’s device while offline.
3. Restore connectivity, then check the lost response with `op_01J6FR84`. Confirm one server shipment exists.
4. Record Priya’s `7,940 L` receipt and observe `−240 L / −2.93%` plus `DISCREPANCY_OPEN`.
5. Resolve with accepted final quantity `7,940 L`. Confirm the original `8,200 / 8,180 / 7,940 L` reports remain visible and `DL-019` is created.
6. Inspect three `HTTP 503` attempts, DLQ movement, and the stable destination key.
7. Replay once and confirm `200 OK`, one destination write, and a complete audit trace.
8. Open `/app/exceptions/EX-0037` and `/app/integrations/DL-019` for the full evidence views.

The browser walkthrough is self-contained for a reviewer. When the API is running, the exception workbench also commits through the real domain service.
