import WorkflowBuilder from "@/components/WorkflowBuilder";
// import Login from "@/components/Login";
import WorkflowGuide from "@/components/others/WorkFlowGuide";

export default function Home() {
  return (
    <div className="h-screen bg-gray-200 flex">
      {/* <Login/> */}
      <WorkflowBuilder />
      <WorkflowGuide />
    </div>
  );
}