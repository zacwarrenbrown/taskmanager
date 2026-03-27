<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->date('deadline')->nullable();
            $table->foreignId('prerequisite_task_id')->nullable()->constrained('tasks')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['prerequisite_task_id']);
            $table->dropColumn(['deadline', 'prerequisite_task_id']);
        });
    }
};
