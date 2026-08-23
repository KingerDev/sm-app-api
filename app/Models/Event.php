<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $fillable = ['title', 'date', 'date_end', 'kind', 'icon', 'note'];

    protected $casts = [
        'date'     => 'date',
        'date_end' => 'date',
    ];
}
