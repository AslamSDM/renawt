"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Spinner } from "@/components/ui";
import { Plus, Film, Clock, Trash2, Copy, Edit2, Check, X } from "lucide-react";

interface Project {
  id: string;
  name: string | null;
  sourceUrl: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Project",
          status: "DRAFT",
        }),
      });

      const data = await response.json();
      if (data.project) {
        router.push(`/projects/${data.project.id}/creative`);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name || "Untitled Project");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveProjectName = async (projectId: string) => {
    if (!editingName.trim()) return;
    
    setSavingName(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (response.ok) {
        setProjects(projects.map(p => 
          p.id === projectId ? { ...p, name: editingName.trim() } : p
        ));
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to update project name:", error);
    } finally {
      setSavingName(false);
    }
  };

  const deleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const duplicateProject = async (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${project.name || "Untitled"} (Copy)`,
          sourceUrl: project.sourceUrl,
          status: "DRAFT",
        }),
      });

      const data = await response.json();
      if (data.project) {
        router.push(`/projects/${data.project.id}/creative`);
      }
    } catch (error) {
      console.error("Failed to duplicate project:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "GENERATING":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "EXPORTED":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? "Just now" : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light">Video Projects</h1>
              <p className="text-gray-500 mt-1">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={createProject}
              disabled={creating}
              className="rounded-lg"
              size="lg"
            >
              {creating ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Plus className="w-5 h-5 mr-2" />
              )}
              New Project
            </Button>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Film className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-light mb-2">No projects yet</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create your first video project to start generating professional product videos with AI
            </p>
            <Button onClick={createProject} disabled={creating} size="lg" className="rounded-lg">
              {creating ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Plus className="w-5 h-5 mr-2" />
              )}
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/creative`}
                className="group block"
              >
                <Card className="h-full hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-white/5">
                  {/* Thumbnail Placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-white/5 to-white/[0.02] rounded-t-lg flex items-center justify-center border-b border-white/5">
                    <Film className="w-12 h-12 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>

                  <div className="p-5">
                    {/* Project Name - Editable */}
                    {editingId === project.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveProjectName(project.id);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-sm focus:outline-none focus:border-white/40"
                          autoFocus
                          onClick={(e) => e.preventDefault()}
                        />
                        <button
                          onClick={(e) => { e.preventDefault(); saveProjectName(project.id); }}
                          disabled={savingName}
                          className="p-1 text-green-400 hover:text-green-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); cancelEditing(); }}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2 group/title">
                        <h3 className="font-medium text-lg line-clamp-1 group-hover:text-white transition-colors flex-1">
                          {project.name || "Untitled Project"}
                        </h3>
                        <button
                          onClick={(e) => startEditing(project, e)}
                          className="opacity-0 group-hover/title:opacity-100 p-1 text-gray-500 hover:text-white transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(project.updatedAt)}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => duplicateProject(project, e)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => deleteProject(project.id, e)}
                          className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}

            {/* Create New Card */}
            <button
              onClick={createProject}
              disabled={creating}
              className="group h-full min-h-[280px]"
            >
              <Card className="h-full border-dashed border-2 border-white/10 hover:border-white/20 hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  {creating ? (
                    <Spinner size="md" />
                  ) : (
                    <Plus className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors" />
                  )}
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  {creating ? "Creating..." : "Create New Project"}
                </span>
              </Card>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
