import { useEffect, useState } from "react";
import { ScrollView, Text, View, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brain, ChevronDown, ChevronRight } from "lucide-react-native";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { api, type Trace } from "@/lib/api";

const TONE: Record<string, "brand" | "accent" | "warn" | "default" | "danger"> = {
  orchestrator: "brand", intent: "accent", discovery: "default", matcher: "brand",
  pricer: "accent", scheduler: "warn", booking: "brand", notification: "default",
  quality: "accent", dispute: "danger", fallback: "warn",
};

export default function TraceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [traces, setTraces] = useState<Trace[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) return;
    api.getTraces(id).then((r) => setTraces(r.traces)).catch(() => setTraces([]));
  }, [id]);

  if (!traces) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator color="#a78bfa" /></View>;
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="flex-row items-center gap-2">
          <Brain size={18} color="#a78bfa" />
          <Text className="text-ink font-semibold">Antigravity reasoning trace</Text>
          <View className="ml-auto"><Badge tone="brand">{traces.length} events</Badge></View>
        </View>
        <Text className="text-[11px] text-ink-dim">Every agent decision the system made on this booking.</Text>

        <SectionTitle hint="Tap a step to inspect output">Timeline</SectionTitle>
        <View className="gap-3">
          {traces.map((t) => {
            const isOpen = !!open[t.id];
            return (
              <Pressable
                key={t.id}
                onPress={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))}
              >
                <Card>
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Badge tone={TONE[t.agent] ?? "default"}>{t.agent}</Badge>
                    <Text className="text-ink text-sm font-medium">{t.step}</Text>
                    {t.model && (
                      <View className="bg-bg-soft border border-line rounded-full px-2 py-0.5">
                        <Text className="text-[10px] text-ink-dim font-mono">{t.model}</Text>
                      </View>
                    )}
                    {typeof t.confidence === "number" && (
                      <Badge tone={t.confidence >= 0.75 ? "accent" : "warn"}>
                        conf {t.confidence.toFixed(2)}
                      </Badge>
                    )}
                    <Text className="ml-auto text-[10px] text-ink-dim font-mono">{t.latency_ms ?? "—"}ms</Text>
                  </View>

                  {t.input_summary ? (
                    <View className="mt-2">
                      <Text className="text-[10px] uppercase text-ink-dim">input</Text>
                      <Text className="text-[11px] font-mono text-ink-muted" numberOfLines={2}>{t.input_summary}</Text>
                    </View>
                  ) : null}

                  {t.rationale ? (
                    <View className="mt-2">
                      <Text className="text-[10px] uppercase text-ink-dim">rationale</Text>
                      <Text className="text-sm text-ink">{t.rationale}</Text>
                    </View>
                  ) : null}

                  {t.output ? (
                    <View className="mt-2">
                      <View className="flex-row items-center gap-1">
                        {isOpen ? <ChevronDown size={12} color="#71717a" /> : <ChevronRight size={12} color="#71717a" />}
                        <Text className="text-[10px] uppercase text-ink-dim">output</Text>
                      </View>
                      {isOpen && (
                        <View className="bg-bg-soft border border-line rounded-lg p-2 mt-1">
                          <Text className="text-[11px] font-mono text-ink-muted">{JSON.stringify(t.output, null, 2)}</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
          {traces.length === 0 && (
            <Card>
              <Text className="text-sm text-ink-muted text-center">No trace events for this booking yet.</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
