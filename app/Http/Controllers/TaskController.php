<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $userId = $request->user()->id;

        $tasks = Task::with(['user:id,name', 'assignee:id,name'])
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhere('assigned_to', $userId);
            })
            ->orderBy('sort_order')
            ->get();

        $users = User::select('id', 'name')->get();

        return Inertia::render('tasks/index', [
            'tasks' => $tasks,
            'users' => $users,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'priority'    => ['required', 'in:first,high,low,last'],
            'assigned_to' => ['nullable', 'exists:users,id'],
        ]);

        $maxOrder = Task::where('priority', $validated['priority'])->max('sort_order') ?? -1;

        $request->user()->tasks()->create([
            ...$validated,
            'sort_order' => $maxOrder + 1,
        ]);

        return back();
    }

    public function update(Request $request, Task $task): RedirectResponse
    {
        Gate::authorize('update', $task);

        $validated = $request->validate([
            'title'           => ['sometimes', 'required', 'string', 'max:255'],
            'completed'       => ['sometimes', 'boolean'],
            'priority'        => ['sometimes', 'in:first,high,low,last'],
            'assigned_to'     => ['sometimes', 'nullable', 'exists:users,id'],
            'delegation_note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'sort_order'      => ['sometimes', 'integer'],
        ]);

        $task->update($validated);

        return back();
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'items'            => ['required', 'array'],
            'items.*.id'       => ['required', 'exists:tasks,id'],
            'items.*.priority' => ['required', 'in:first,high,low,last'],
            'items.*.order'    => ['required', 'integer'],
        ]);

        foreach ($validated['items'] as $item) {
            Task::where('id', $item['id'])->update([
                'priority'   => $item['priority'],
                'sort_order' => $item['order'],
            ]);
        }

        return back();
    }

    public function destroy(Task $task): RedirectResponse
    {
        Gate::authorize('delete', $task);

        $task->delete();

        return back();
    }
}
