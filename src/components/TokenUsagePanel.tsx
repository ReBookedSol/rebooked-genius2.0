import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TokenUsage } from '@/contexts/LessonGenerationContext';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface TokenUsagePanelProps {
  usage: TokenUsage;
  isProcessing: boolean;
}

export function TokenUsagePanel({
  usage,
  isProcessing,
}: TokenUsagePanelProps) {
  // Rough cost estimates (as of 2024)
  const costPerMTok = {
    openai: {
      input: 0.005, // GPT-4o input
      output: 0.015, // GPT-4o output
      miniInput: 0.00015, // GPT-4o-mini input
      miniOutput: 0.0006, // GPT-4o-mini output
    },
    google: {
      input: 0.00075, // Gemini 1.5 Pro input
      output: 0.003, // Gemini 1.5 Pro output
      flashInput: 0.000075, // Gemini 2.0 Flash Lite input
      flashOutput: 0.0003, // Gemini 2.0 Flash Lite output
    },
  };

  const estimateCost = () => {
    const mtokFactor = 1000000;
    // Google Gemini: 100% Gemini 2.0 Flash Lite for all operations
    const inputCost = (usage.inputTokens * costPerMTok.google.flashInput) / mtokFactor;
    const outputCost = (usage.outputTokens * costPerMTok.google.flashOutput) / mtokFactor;
    return inputCost + outputCost;
  };

  const estimatedCost = estimateCost();

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Token Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Provider</p>
          <p className="font-medium text-foreground">
            Gemini 3.1 Pro
          </p>
        </div>

        {/* Input Tokens */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Input Tokens</p>
          <p className="text-2xl font-bold text-foreground">
            {usage.inputTokens.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Prompt tokens</p>
        </div>

        {/* Output Tokens */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Output Tokens</p>
          <p className="text-2xl font-bold text-foreground">
            {usage.outputTokens.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Generated tokens</p>
        </div>

        {/* Total Tokens */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Total Tokens</p>
          <p className="text-2xl font-bold text-foreground">
            {usage.totalTokens.toLocaleString()}
          </p>
        </div>

        {/* Estimated Cost */}
        <div className="pt-4 border-t border-border bg-muted/50 -mx-6 px-6 py-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Estimated Cost</p>
          <p className="text-lg font-bold text-foreground">
            ${estimatedCost.toFixed(4)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            Rough estimate based on public pricing
          </p>
        </div>

        {/* Note */}
        {isProcessing && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Usage updates in real-time during processing
          </p>
        )}
      </CardContent>
    </Card>
  );
}
