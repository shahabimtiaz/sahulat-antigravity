import { useEffect, useState, useCallback } from "react";
import { ScrollView, Text, View, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Activity, Brain, Layers, GitBranch, Receipt, MessageSquareWarning, FileText } from "lucide-react-native";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { api, type AgentsManagerPayload } from "@/lib/api";

const AGENT_LIST: Array<{ key: string; label: string; role: string; skill: string }> = [
  { key: "orchestrator", label: "Orchestrator", role: "Routes the workflow end-to-end", skill: "workflow:book-service" },
  { key: "intent",       label: "Intent",       role: "Multilingual parsing & confidence", skill: "intent-extraction" },
  { key: "discovery",    label: "Discovery",    role: "Places API + seed merge", skill: "provider-matching" },
  { key: "matcher",      label: "Matcher",      role: "11-factor weighted ranking", skill: "provider-matching" },
  { key: "pricer",       label: "Pricer",       role: "Transparent dynamic pricing", skill: "dynamic-pricing" },
  { key: "scheduler",    label: "Scheduler",    role: "Conflict-free slot reservation", skill: "scheduling" },
  { key: "quality",      label: "Quality",      role: "Lifecycle + sentiment + reputation", skill: "service-quality-loop" },
  { key: "dispute",      label: "Dispute",      role: "Evidence-weighted resolution", skill: "dispute-resolution" },
];

const TONE: Record<string, "brand" | "accent" | "warn" | "default" | "danger"> = {
  orchestrator: "brand", intent: "accent", discovery: "default", matcher: "brand",
  pricer: "accent", scheduler: "warn", booking: "brand", notification: "default",
  quality: "accent", dispute: "danger", fallback: "warn",
};

export default function AgentsScreen() {
  const router = useRouter();
  const [data, setData] = useState<AgentsManagerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.agents();
      setData(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!data && !error) {
    return <View className="flex-1 items-center justify-center bg-bg"><ActivityIndicator color="#a78bfa" /></View>;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
        <View className="p-6">
          <Card className="border-danger/30">
            <Text className="text-ink font-medium mb-2">Couldn't reach the orchestrator</Text>
            <Text className="text-sm text-ink-muted">{error}</Text>
            <Text className="text-[11px] text-ink-dim mt-3">Make sure EXPO_PUBLIC_API_BASE points at your dev server.</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const perAgent = new Map(data!.agents.map((a) => [a.agent, a]));

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />}
      >
        {/* Header */}
        <View>
          <View className="flex-row items-center gap-2 mb-1">
            <Brain size={20} color="#a78bfa" />
            <Text className="text-xl font-semibold text-ink">Agent Manager</Text>
            <View className="ml-auto"><Badge tone="brand">Live</Badge></View>
          </View>
          <Text className="text-[11px] text-ink-muted">
            Antigravity-style surface: skills, workflows, parallel agents, artifacts.
          </Text>
        </View>

        {/* Agents */}
        <View>
          <SectionTitle hint={`${AGENT_LIST.length} agents running in parallel`}>Agents</SectionTitle>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {AGENT_LIST.map((a) => {
              const stats = perAgent.get(a.key) ?? { runs_24h: 0, avg_latency_ms: 0, latest_at: null, last_rationale: null };
              const idle = stats.runs_24h === 0;
              return (
                <View key={a.key} className="bg-bg-elev/80 border border-line rounded-2xl p-3" style={{ width: "48.5%" }}>
                  <View className="flex-row items-center gap-2">
                    <Badge tone={TONE[a.key] ?? "default"}>{a.label}</Badge>
                    <View className={`size-2 rounded-full ml-auto ${idle ? "bg-ink-dim" : "bg-accent"}`} />
                  </View>
                  <Text className="text-[11px] text-ink-muted mt-2" numberOfLines={2}>{a.role}</Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-[10px] text-ink-dim font-mono">{stats.runs_24h} runs</Text>
                    <Text className="text-[10px] text-ink-dim font-mono">{stats.avg_latency_ms}ms</Text>
                  </View>
                  {stats.last_rationale ? (
                    <Text className="text-[10px] text-ink-muted italic mt-2 border-t border-line pt-2" numberOfLines={2}>
                      {stats.last_rationale}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center gap-1 mt-2">
                    <FileText size={9} color="#71717a" />
                    <Text className="text-[9px] text-ink-dim" numberOfLines={1}>{a.skill}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Skills */}
        <View>
          <SectionTitle hint={`${data!.skills.length} loaded from .agent/skills/*/SKILL.md`}>Skills</SectionTitle>
          <Card className="p-0 overflow-hidden">
            {data!.skills.map((s, i) => (
              <View key={s.name} className={`p-3 flex-row items-start gap-2 ${i > 0 ? "border-t border-line" : ""}`}>
                <Layers size={14} color="#a78bfa" />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-ink font-mono">{s.name}</Text>
                    <Text className="text-[10px] text-ink-dim font-mono">{s.body_length} chars</Text>
                  </View>
                  <Text className="text-[11px] text-ink-muted mt-1" numberOfLines={2}>{s.description}</Text>
                </View>
              </View>
            ))}
            {data!.skills.length === 0 && (
              <View className="p-6"><Text className="text-sm text-ink-muted text-center">No skills found.</Text></View>
            )}
          </Card>
        </View>

        {/* Workflows */}
        <View>
          <SectionTitle hint={`${data!.workflows.length} loaded from .agent/workflows/*.md`}>Workflows</SectionTitle>
          <Card className="p-0 overflow-hidden">
            {data!.workflows.map((w, i) => (
              <View key={w.name} className={`p-3 flex-row items-start gap-2 ${i > 0 ? "border-t border-line" : ""}`}>
                <GitBranch size={14} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="text-xs text-ink font-mono">{w.name}</Text>
                  <Text className="text-[11px] text-ink-muted mt-1" numberOfLines={2}>{w.description}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* Live event stream */}
        <View>
          <SectionTitle hint="Last 40 events across all agents">Live event stream</SectionTitle>
          <Card className="p-0 overflow-hidden">
            {(data!.recent_traces.slice(0, 40)).map((t, i) => (
              <View key={t.id ?? i} className={`p-3 flex-row items-start gap-2 ${i > 0 ? "border-t border-line" : ""}`}>
                <Activity size={12} color="#71717a" />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Badge tone={TONE[t.agent] ?? "default"}>{t.agent}</Badge>
                    <Text className="text-xs text-ink font-medium">{t.step}</Text>
                    <Text className="text-[10px] text-ink-dim font-mono ml-auto">{t.latency_ms ?? "—"}ms</Text>
                  </View>
                  {t.rationale ? (
                    <Text className="text-[11px] text-ink-muted mt-1" numberOfLines={2}>{t.rationale}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {data!.recent_traces.length === 0 && (
              <View className="p-6">
                <Text className="text-sm text-ink-muted text-center">No trace events yet.</Text>
                <Text className="text-[11px] text-ink-dim text-center mt-1">Submit a request from the home screen to populate this.</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Artifacts */}
        <View>
          <SectionTitle hint="Recent deliverables produced by the agents">Artifacts</SectionTitle>
          <View className="gap-3">
            {data!.artifacts.bookings.map((b) => (
              <Pressable key={b.id} onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id } })}>
                <Card>
                  <View className="flex-row items-center gap-2">
                    <Receipt size={14} color="#10b981" />
                    <Badge tone="accent">{b.status}</Badge>
                    <Text className="ml-auto text-xs font-mono text-ink">PKR {(b.total_price ?? 0).toLocaleString()}</Text>
                  </View>
                  <Text className="text-sm text-ink mt-2" numberOfLines={2}>{b.request_text}</Text>
                  <Text className="text-[10px] text-ink-dim font-mono mt-2">
                    {b.service} · {new Date(b.created_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                  </Text>
                </Card>
              </Pressable>
            ))}
            {data!.artifacts.disputes.map((d) => (
              <Pressable key={d.id} onPress={() => router.push({ pathname: "/booking/[id]", params: { id: d.booking_id } })}>
                <Card className="border-danger/30">
                  <View className="flex-row items-center gap-2">
                    <MessageSquareWarning size={14} color="#ef4444" />
                    <Badge tone="danger">{d.case_type}</Badge>
                    <View className="ml-auto"><Badge tone="default">{d.status}</Badge></View>
                  </View>
                  <Text className="text-sm text-ink mt-2">
                    decision: <Text className="text-ink-muted font-mono">{d.decision}</Text>
                  </Text>
                  <Text className="text-[10px] text-ink-dim font-mono mt-2">
                    refund: PKR {(d.refund_amount ?? 0).toLocaleString()} · {new Date(d.created_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                  </Text>
                </Card>
              </Pressable>
            ))}
            {data!.artifacts.bookings.length === 0 && data!.artifacts.disputes.length === 0 && (
              <Card>
                <Text className="text-sm text-ink-muted text-center">No artifacts yet. Submit a request to generate one.</Text>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
