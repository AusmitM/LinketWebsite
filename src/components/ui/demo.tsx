import * as React from "react";
import { Scissors, Signal, Video } from "lucide-react";

import { WorkspaceWelcome, type ActionItem } from "@/components/ui/welcome";

const WorkspaceWelcomeDemo = () => {
  const actions: ActionItem[] = [
    {
      icon: <Scissors className="h-4 w-4 text-purple-500" />,
      label: "Create Project",
      onClick: () => alert("Create Project clicked!"),
    },
    {
      icon: <Video className="h-4 w-4 text-red-500" />,
      label: "Record Video",
      onClick: () => alert("Record Video clicked!"),
    },
    {
      icon: <Signal className="h-4 w-4 text-blue-500" />,
      label: "Go Live",
      isBeta: true,
      onClick: () => alert("Go Live clicked!"),
    },
  ];

  const handlePlayVideo = () => {
    console.log("Playing video: https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    alert("Play Video clicked! Check the console for the video link.");
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <WorkspaceWelcome
        userName="Ravi Katiyar"
        actions={actions}
        videoThumbnail="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop"
        videoTitle="Welcome to VEED.IO"
        videoDescription="Learn about VEED in less than 2 minutes!"
        onPlayVideo={handlePlayVideo}
      />
    </div>
  );
};

export default WorkspaceWelcomeDemo;
