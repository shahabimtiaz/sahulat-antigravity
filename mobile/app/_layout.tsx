import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0a0a0b" },
            headerTintColor: "#f5f5f7",
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: "#0a0a0b" },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" options={{ title: "Sahulat" }} />
          <Stack.Screen name="request" options={{ title: "New request" }} />
          <Stack.Screen name="booking/[id]" options={{ title: "Booking" }} />
          <Stack.Screen name="trace/[id]" options={{ title: "Agent trace" }} />
          <Stack.Screen name="agents" options={{ title: "Agent Manager" }} />
          <Stack.Screen name="provider-dashboard" options={{ title: "Provider dashboard" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
