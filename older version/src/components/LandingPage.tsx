import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { BarChart3, TrendingUp, MapPin, Target, DollarSign, Users, ArrowRight } from "lucide-react";

interface LandingPageProps {
  onSelectModule: (module: "market-size" | "market-attractiveness") => void;
}

export function LandingPage({ onSelectModule }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header Section */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-end">
            <div className="flex items-center justify-center px-6 py-3 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
              <span className="text-sm text-slate-400 font-medium">Logo Placeholder</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-700">Enterprise Analytics Platform</span>
          </div>
          <h2 className="text-5xl font-bold text-slate-900 tracking-tight">
            Strategic Market Intelligence
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Powerful analytics tools to evaluate market opportunities, assess competitive landscapes, and drive data-driven expansion strategies
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Market Size & Share Tool */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="space-y-4 relative pb-6">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:shadow-blue-600/40 transition-shadow">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-100 border border-amber-200">
                  <span className="text-xs font-semibold text-amber-700">Coming Soon</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Market Size & Share</CardTitle>
                <CardDescription className="text-base text-slate-600">
                  Comprehensive analysis of market dynamics, competitive positioning, and share distribution across providers
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 relative">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Market Sizing</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Total addressable market analysis with revenue potential forecasting
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Competitive Landscape</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Key player identification and competitive positioning analysis
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Share Distribution</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Regional and provider-level market share tracking
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 group-hover:shadow-blue-600/40 transition-all" 
                size="lg"
                onClick={() => onSelectModule("market-size")}
              >
                Launch Module
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* Market Attractiveness Tool */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="space-y-4 relative pb-6">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition-shadow">
                  <TrendingUp className="h-7 w-7 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-700">Demo</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Market Attractiveness</CardTitle>
                <CardDescription className="text-base text-slate-600">
                  Evaluate market opportunities and identify high-potential MSAs with data-driven scoring models
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 relative">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Geographic Analysis</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Interactive map-based MSA exploration with comparative metrics
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Attractiveness Scoring</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Multi-factor scoring engine with customizable weighting
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Target className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Competitor Intelligence</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Deep-dive analysis of competitor presence and white space opportunities
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition-all" 
                size="lg"
                onClick={() => onSelectModule("market-attractiveness")}
              >
                Launch Module
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer Section */}
        <div className="mt-16 text-center space-y-4">
          <div className="max-w-3xl mx-auto p-6 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">Enterprise Features</p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Advanced filtering • Customizable parameters • Real-time analytics • Comprehensive data export • Interactive visualizations
            </p>
          </div>
          <p className="text-xs text-slate-400">
            © 2026 Coalition Greenwich Strategic Market Intelligence Suite
          </p>
        </div>
      </div>
    </div>
  );
}