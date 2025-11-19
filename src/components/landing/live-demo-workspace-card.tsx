"use client";

import { useCallback } from "react";

import { Scissors, Signal, Video } from "lucide-react";

import { WorkspaceWelcome, type ActionItem } from "@/components/ui/welcome";

function LiveDemoWorkspaceCard() {
  const actions: ActionItem[] = [
    {
      icon: <Video className="h-4 w-4 text-primary" aria-hidden />,
      label: "Watch full demo",
      onClick: () => console.log("User opened the full walkthrough video."),
    },
    {
      icon: <Scissors className="h-4 w-4 text-orange-400" aria-hidden />,
      label: "Customize card",
      onClick: () =>
        console.log("User wants to customize their Linket hardware."),
    },
    {
      icon: <Signal className="h-4 w-4 text-emerald-500" aria-hidden />,
      label: "Go live",
      isBeta: true,
      onClick: () => console.log("User toggled live analytics beta."),
    },
  ];

  const handlePlayVideo = useCallback(() => {
    console.log("Play See it live video: https://linket.app/demo");
  }, []);

  return (
    <WorkspaceWelcome
      className="mt-6 bg-white/90 p-0 sm:p-2"
      userName="Field Crew"
      actions={actions}
      videoThumbnail="https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=1200&q=80"
      videoTitle="Linket, in motion"
      videoDescription="Watch how reps tap, capture, and send intros in under a minute."
      onPlayVideo={handlePlayVideo}
    />
  );
}

export { LiveDemoWorkspaceCard };
