import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, TrendingUp, Users } from "lucide-react-native";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { api, type ProviderRec, type DemandForecast } from "@/lib/api";

const CITIES = ["Islamabad", "Rawalpindi", "Lahore"] as const;
type City = typeof CITIES[number];

export default function ProviderDashboard() {
  const [city, setCity] = useState<City>("Islamabad");
  const [data, setData] = useState<{ recommendations: ProviderRec[]; demand_forecast: DemandForecast[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (c: City) => {
    try {
      const r = await api.providerOptimize(c);
      setData(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(city); }, [city, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(city); setRefreshing(false);
  }, [city, load]);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="p-6">
          <Card className="border-danger/30">
            <Text className="text-ink font-medium mb-2">Couldn't reach the orchestrator</Text>
            <Text className="text-sm text-ink-muted">{error}</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator color="#a78bfa" /></View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />}
      >
        <View>
          <Text className="text-xl font-semibold text-ink mb-1">Provider dashboard</Text>
          <Text className="text-[11px] text-ink-muted">Workload, utilization, demand forecast.</Text>
        </View>

        {/* City switcher */}
        <View className="flex-row gap-2">
          {CITIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCity(c)}
              className={`px-3 py-1.5 rounded-full border ${city === c ? "bg-brand border-brand" : "bg-bg-elev border-line"}`}
            >
              <Text className={`text-xs ${city === c ? "text-white font-medium" : "text-ink-muted"}`}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {/* Demand forecast */}
        <View>
          <SectionTitle hint="Top hours by expected jobs (last 7d baseline)">Demand forecast</SectionTitle>
          <Card>
            {data.demand_forecast.slice(0, 6).map((f, i) => (
              <View key={i} className="flex-row items-center gap-3 py-1.5">
                <Clock size={12} color="#71717a" />
                <Text className="text-xs font-mono text-ink-muted w-12">{String(f.hour).padStart(2, "0")}:00</Text>
                <Text className="text-sm text-ink capitalize">{f.service.replace("_", " ")}</Text>
                <View className="ml-auto"><Badge tone="brand">{f.expected_jobs} jobs</Badge></View>
              </View>
            ))}
            {data.demand_forecast.length === 0 && (
              <Text className="text-sm text-ink-muted text-center py-3">No bookings in the last 7 days yet — forecast populates as data accrues.</Text>
            )}
          </Card>
        </View>

        {/* Provider recommendations */}
        <View>
          <SectionTitle hint="Workload-balanced suggestions per provider">Provider workload</SectionTitle>
          <View className="gap-3">
            {data.recommendations.map((p) => (
              <Card key={p.provider_id}>
                <View className="flex-row items-start gap-3">
                  <View className="size-9 rounded-xl bg-brand/10 border border-brand/20 items-center justify-center">
                    <Text className="text-brand-soft text-xs font-semibold">{p.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink font-medium" numberOfLines={1}>{p.name}</Text>
                    {p.suggested_slots.length > 0 && (
                      <Text className="text-[11px] text-ink-muted mt-1">Slots: {p.suggested_slots.join(" · ")}</Text>
                    )}
                  </View>
                  <Badge tone={p.utilization > 0.7 ? "warn" : p.utilization < 0.3 ? "default" : "accent"}>
                    <Users size={9} color="#a1a1aa" /> {Math.round(p.utilization * 100)}%
                  </Badge>
                </View>
                <View className="flex-row items-center gap-1 mt-2">
                  <TrendingUp size={11} color="#71717a" />
                  <Text className="text-[11px] text-ink-muted flex-1" numberOfLines={2}>{p.reason}</Text>
                </View>
              </Card>
            ))}
            {data.recommendations.length === 0 && (
              <Card>
                <Text className="text-sm text-ink-muted text-center">No providers in {city}.</Text>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
