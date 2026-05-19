import { Pressable, Text, View, ActivityIndicator } from "react-native";
import type { PressableProps, ViewProps } from "react-native";
import { Children, useRef } from "react";
import type { ReactNode } from "react";

export function Card({ children, className = "", ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`bg-bg-elev/80 border border-line rounded-2xl p-4 ${className}`}
    >
      {children}
    </View>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  className = "",
  ...rest
}: PressableProps & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { onPress, disabled, ...pressableProps } = rest;
  const lastInvokeRef = useRef(0);
  const invokePress: NonNullable<PressableProps["onPress"]> = (event) => {
    if (disabled) return;
    const now = Date.now();
    if (now - lastInvokeRef.current < 100) return;
    lastInvokeRef.current = now;
    onPress?.(event);
  };
  const v = {
    primary: "bg-brand",
    secondary: "bg-bg-elev border border-line",
    ghost: "bg-transparent",
    danger: "bg-danger",
  }[variant];
  const s = { sm: "h-9 px-3", md: "h-11 px-4", lg: "h-12 px-5" }[size];
  const txtColor = variant === "secondary" || variant === "ghost" ? "text-ink" : "text-white";
  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      onPress={invokePress}
      className={`flex-row items-center justify-center gap-2 rounded-xl ${v} ${s} active:opacity-80 ${className}`}
    >
      {loading ? <ActivityIndicator color="#fff" size="small" /> : null}
      {typeof children === "string" ? (
        <Text className={`font-medium ${txtColor}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function Badge({
  children,
  tone = "default",
}: { children: ReactNode; tone?: "default" | "brand" | "accent" | "warn" | "danger" }) {
  const map = {
    default: "bg-bg-elev border-line",
    brand: "bg-brand/10 border-brand/30",
    accent: "bg-accent/10 border-accent/30",
    warn: "bg-warn/10 border-warn/30",
    danger: "bg-danger/10 border-danger/30",
  }[tone];
  const textColor = {
    default: "text-ink-muted",
    brand: "text-brand-soft",
    accent: "text-accent",
    warn: "text-warn",
    danger: "text-danger",
  }[tone];
  const content = Children.map(children, (child) => (
    typeof child === "string" || typeof child === "number"
      ? <Text className={`text-[11px] font-medium ${textColor}`}>{child}</Text>
      : child
  ));
  return (
    <View className={`px-2.5 py-0.5 rounded-full border ${map} self-start flex-row items-center gap-1`}>
      {content}
    </View>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View className="mb-2">
      <Text className="text-[11px] uppercase tracking-wider font-semibold text-ink-muted">{children}</Text>
      {hint ? <Text className="text-[11px] text-ink-dim mt-0.5">{hint}</Text> : null}
    </View>
  );
}
