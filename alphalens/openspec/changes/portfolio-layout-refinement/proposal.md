# Proposal: Portfolio Layout Refinement

## What is the goal?
重新設計「My Portfolio」頁面的版面佈局。目前「Add New Holding」表單與「Current Holdings」持股清單被強制放在同一個 `stock-detail-grid`（2fr 1fr）的水平網格中，這導致持股清單在右側被嚴重擠壓，且最右側的資訊無法顯示。
本提案旨在將兩者改為垂直排列（上下佈局），並確保持股表格具備水平捲軸 (Horizontal Scrollbar) 功能，讓所有欄位資訊都能清晰可見。

## Why are we doing this?
- **解決版面擠壓問題**：持股清單（Current Holdings）包含超過 7 個欄位，需要橫向空間。水平網格佈局會讓它被壓扁。
- **改善使用者體驗 (UX)**：當欄位過多時，表格不應換行擠壓文字，而是應保持單行顯示並提供水平滾動條，確保數值（如 P/L、Signal）易於閱讀。
- **防止元件互相干擾**：表單與表格在高度與寬度上完全解耦，未來的擴充（例如新增更多表單欄位或表格欄位）將不再互相影響。
- **強化決策視覺化**：加上 PIP 點的日期與價格標籤，讓交易者一眼看穿轉折點；加上成交量，輔助判斷該轉折是否帶量。

## Success Metrics
- 「Add New Holding」位於上方，「Current Holdings」位於下方且具備水平捲軸。
- K 線圖上的 PIP 轉折點會標示清晰的圓點、日期與價格。
- K 線圖下方會固定顯示綠紅雙色的成交量柱狀圖。
