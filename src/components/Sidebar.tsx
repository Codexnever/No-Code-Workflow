"use client";
import { useState } from "react";
import { LayoutDashboard, Settings, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AiNode from "./nodes/AiNode";
import Login from "./Login";

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-60 bg-gray-900 text-white flex flex-col p-4">
        <h1 className="text-xl font-bold mb-6">AI Workflow</h1>
        <nav className="flex flex-col space-y-4">
          <button
            className={`flex items-center space-x-2 p-2 rounded-lg ${
              activeTab === "dashboard" ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Main Workflow</span>
          </button>

          <button
            className={`flex items-center space-x-2 p-2 rounded-lg ${
              activeTab === "login" ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
            onClick={() => setActiveTab("login")}
          >
            <Box className="w-5 h-5" />
            <span>Login</span>
          </button>

          <button
            className={`flex items-center space-x-2 p-2 rounded-lg ${
              activeTab === "settings" ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
            onClick={() => setActiveTab("settings")}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Content Area with Animation */}
      <div className="flex-1 p-4">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <AiNode />
            </motion.div>
          )}
          {activeTab === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Login />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Sidebar;
