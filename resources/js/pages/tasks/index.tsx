import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Circle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

type Task = {
    id: number;
    title: string;
    completed: boolean;
    created_at: string;
};

type Filter = 'all' | 'active' | 'done';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Tasks', href: '/tasks' }];

export default function TasksIndex({ tasks }: { tasks: Task[] }) {
    const [filter, setFilter] = useState<Filter>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const { data, setData, post, processing, errors, reset } = useForm({ title: '' });

    const visible = tasks.filter((t) => {
        if (filter === 'active') return !t.completed;
        if (filter === 'done') return t.completed;
        return true;
    });

    const activeCount = tasks.filter((t) => !t.completed).length;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/tasks', { preserveScroll: true, onSuccess: () => reset() });
    }

    function toggle(task: Task) {
        router.patch(`/tasks/${task.id}`, { completed: !task.completed }, { preserveScroll: true });
    }

    function startEdit(task: Task) {
        setEditingId(task.id);
        setEditValue(task.title);
    }

    function commitEdit(task: Task) {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== task.title) {
            router.patch(`/tasks/${task.id}`, { title: trimmed }, { preserveScroll: true });
        }
        setEditingId(null);
    }

    function cancelEdit() {
        setEditingId(null);
    }

    function destroy(task: Task) {
        router.delete(`/tasks/${task.id}`, { preserveScroll: true });
    }

    function clearDone() {
        tasks
            .filter((t) => t.completed)
            .forEach((t) => router.delete(`/tasks/${t.id}`, { preserveScroll: true }));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tasks" />

            <div className="flex flex-col gap-6 p-6">
                <div className="max-w-xl">
                    <h1 className="mb-1 text-2xl font-semibold tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground">
                        {activeCount} {activeCount === 1 ? 'task' : 'tasks'} remaining
                    </p>
                </div>

                {/* Add task form */}
                <form onSubmit={submit} className="flex max-w-xl gap-2">
                    <div className="flex-1">
                        <Input
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="Add a new task…"
                            aria-label="New task title"
                            autoComplete="off"
                        />
                        <InputError message={errors.title} className="mt-1" />
                    </div>
                    <Button type="submit" disabled={processing || !data.title.trim()}>
                        <Plus className="size-4" />
                        Add
                    </Button>
                </form>

                {/* Filters */}
                <div className="flex max-w-xl items-center justify-between">
                    <div className="flex gap-1">
                        {(['all', 'active', 'done'] as Filter[]).map((f) => (
                            <Button
                                key={f}
                                variant={filter === f ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter(f)}
                                className="capitalize"
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                    {tasks.some((t) => t.completed) && (
                        <Button variant="ghost" size="sm" onClick={clearDone} className="text-muted-foreground hover:text-destructive">
                            Clear completed
                        </Button>
                    )}
                </div>

                {/* Task list */}
                <ul className="flex max-w-xl flex-col gap-2">
                    {visible.length === 0 && (
                        <li className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                            No tasks here.
                        </li>
                    )}

                    {visible.map((task) => (
                        <li
                            key={task.id}
                            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                        >
                            {/* Toggle */}
                            <button
                                type="button"
                                onClick={() => toggle(task)}
                                className="flex-shrink-0 text-muted-foreground transition-colors hover:text-primary"
                                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                            >
                                {task.completed ? (
                                    <CheckCircle2 className="size-5 text-primary" />
                                ) : (
                                    <Circle className="size-5" />
                                )}
                            </button>

                            {/* Title / edit input */}
                            {editingId === task.id ? (
                                <input
                                    className="flex-1 border-b border-ring bg-transparent text-sm outline-none"
                                    value={editValue}
                                    autoFocus
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => commitEdit(task)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitEdit(task);
                                        if (e.key === 'Escape') cancelEdit();
                                    }}
                                />
                            ) : (
                                <span
                                    className={cn('flex-1 text-sm', task.completed && 'text-muted-foreground line-through')}
                                >
                                    {task.title}
                                </span>
                            )}

                            {/* Actions */}
                            {editingId === task.id ? (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="Cancel edit"
                                >
                                    <X className="size-4" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => startEdit(task)}
                                        className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                                        aria-label="Edit task"
                                    >
                                        <Pencil className="size-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => destroy(task)}
                                        className="flex-shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                                        aria-label="Delete task"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </AppLayout>
    );
}
