# Proposal: PIP Algorithm Refinement (Dynamic MSE Optimization)

## What is the goal?
目前我們實作的 PIP (Perceptually Important Points) 演算法是採用固定的 `numPIPs = 7` 來尋找轉折點。這在不同波動度的股票上可能不夠精確。
根據提供的 `TW_stock_crawler.ipynb`，該作者利用了**垂直距離 (Vertical Distance)**，搭配 **MSE (Mean Squared Error) 遞減速率的移動平均 (MRAVG)**，來動態決定最佳的 PIP 數量。
本提案旨在將此動態選取邏輯整合進 AlphaLens 系統中，讓系統自動判斷每一檔股票在當前區間內「最適合的轉折點數量」。

## Why are we doing this?
- **提升訊號精準度**：波動大的股票需要更多 PIP，盤整的股票需要較少 PIP。動態選取能確保我們不會過度擬合 (Overfitting) 或欠擬合 (Underfitting) 趨勢。
- **學術與實務結合**：完整還原 Notebook 中的演算法精髓，包括標準化 (StandardScaler) 與動態切割區間 (`pip_update_phpe`) 的機制，以提升決策紅綠燈的勝率。

## Success Metrics
- 能夠在 `app.js` 中動態算出每檔股票歷史資料的最佳 PIP 數量。
- 繪製在 lightweight-charts 上的黃色虛線能更完美地貼合實際的關鍵支撐壓力位。
- 系統維持高效，不因為動態計算而造成網頁卡頓。
