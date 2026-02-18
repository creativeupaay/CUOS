import { useParams } from 'react-router-dom';
import { useGetTasksQuery, useCreateTaskMutation, useUpdateTaskMutation } from '@/features/project';
import { useState } from 'react';

export default function ProjectTasksTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);

    const { data, isLoading } = useGetTasksQuery({ projectId: projectId! });
    const tasks = data?.data || [];

    const [createTask] = useCreateTaskMutation();
    const [updateTask] = useUpdateTaskMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const taskData = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            status: formData.get('status') as any,
            priority: formData.get('priority') as any,
            deadline: formData.get('deadline') as string,
        };

        try {
            if (editingTask) {
                await updateTask({
                    projectId: projectId!,
                    taskId: editingTask._id,
                    data: taskData,
                }).unwrap();
            } else {
                await createTask({ projectId: projectId!, data: taskData }).unwrap();
            }
            setShowForm(false);
            setEditingTask(null);
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    };

    if (isLoading) {
        return <div>Loading tasks...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Tasks</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    New Task
                </button>
            </div>

            {/* Task Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">
                        {editingTask ? 'Edit Task' : 'New Task'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                defaultValue={editingTask?.title}
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                name="description"
                                defaultValue={editingTask?.description}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    name="status"
                                    defaultValue={editingTask?.status || 'todo'}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="todo">To Do</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="review">Review</option>
                                    <option value="completed">Completed</option>
                                    <option value="blocked">Blocked</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Priority</label>
                                <select
                                    name="priority"
                                    defaultValue={editingTask?.priority || 'medium'}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Deadline</label>
                                <input
                                    type="date"
                                    name="deadline"
                                    defaultValue={editingTask?.deadline?.split('T')[0]}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                {editingTask ? 'Update' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingTask(null);
                                }}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Task List */}
            <div className="space-y-3">
                {tasks.map((task) => (
                    <div
                        key={task._id}
                        className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-lg">{task.title}</h3>
                            <div className="flex gap-2">
                                <span
                                    className={`px-2 py-1 text-xs rounded ${task.status === 'completed'
                                            ? 'bg-green-100 text-green-800'
                                            : task.status === 'in-progress'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    {task.status}
                                </span>
                                <span
                                    className={`px-2 py-1 text-xs rounded ${task.priority === 'critical'
                                            ? 'bg-red-100 text-red-800'
                                            : task.priority === 'high'
                                                ? 'bg-orange-100 text-orange-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                >
                                    {task.priority}
                                </span>
                            </div>
                        </div>

                        {task.description && (
                            <p className="text-gray-600 mb-3">{task.description}</p>
                        )}

                        <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>
                                {task.assignees.length} assignee{task.assignees.length !== 1 ? 's' : ''}
                            </span>
                            {task.deadline && (
                                <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                            )}
                            <button
                                onClick={() => {
                                    setEditingTask(task);
                                    setShowForm(true);
                                }}
                                className="text-blue-600 hover:underline"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                ))}

                {tasks.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No tasks yet. Create your first task!
                    </div>
                )}
            </div>
        </div>
    );
}
