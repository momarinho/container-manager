import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CircleAlert, CircleCheckBig, LoaderCircle } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

export interface ActionFeedback {
  tone: "loading" | "success" | "error";
  message: string;
}

interface Props {
  feedback: ActionFeedback | null;
}

export default function ActionFeedbackBanner({ feedback }: Props) {
  if (!feedback) {
    return null;
  }

  const isLoading = feedback.tone === "loading";
  const isSuccess = feedback.tone === "success";

  return (
    <View
      style={[
        styles.banner,
        isLoading && styles.bannerLoading,
        isSuccess && styles.bannerSuccess,
        feedback.tone === "error" && styles.bannerError,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.onSurface} />
      ) : isSuccess ? (
        <CircleCheckBig size={16} color={Colors.tertiary} />
      ) : (
        <CircleAlert size={16} color={Colors.error} />
      )}
      <Text style={styles.message}>{feedback.message}</Text>
      {isLoading ? <LoaderCircle size={14} color={Colors.outline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: "rgba(65, 71, 82, 0.4)",
  },
  bannerLoading: {
    borderColor: "rgba(88, 166, 255, 0.4)",
  },
  bannerSuccess: {
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  bannerError: {
    borderColor: "rgba(255, 180, 171, 0.35)",
  },
  message: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 13,
    lineHeight: 18,
  },
});
