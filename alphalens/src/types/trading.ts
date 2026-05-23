// 關鍵價位與趨勢
export interface KeyLevels {
  resistance2: number;
  resistance1: number;
  currentPrice: number;
  support1: number;
  support2: number;
  strongSupport?: number;
}

export interface TrendDiagnosis {
  status: string;      // 例如: "多頭格局，短線回調"
  position: string;    // 例如: "回測短期均線支撐"
  conclusion: string;  // 例如: "區間震盪，等待支撐確認"
}

// 交易策略定義
export interface StrategyCondition {
  condition: string;   // 條件說明
  entryRange: string;  // 進場區間
  stopLoss: number;    // 停損價
  targets: number[];   // 目標價位 [目標1, 目標2]
  exitStrategies: {
    takeProfit: string;    // 停利出場
    trailingStop: string;  // 移動停利
    timeExit?: string;     // 時間出場
    reversalExit?: string; // 反轉出場
  };
}

export interface TradingPlanData {
  ticker: string;
  name: string;
  date: string;
  trend: TrendDiagnosis;
  levels: KeyLevels;
  bullishStrategy: StrategyCondition;
  bearishStrategy: StrategyCondition;
  confidence: number; // 機率/信心度百分比
}
