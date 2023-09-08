// Copyright (c) 2023, Oracle.
// Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
package com.example.controller;

import com.example.domain.Genre;
import com.example.service.GenreService;
import io.micronaut.data.model.Pageable;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import io.micronaut.http.annotation.Status;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.net.URI;
import java.util.List;
import java.util.Optional;

import static io.micronaut.http.HttpHeaders.LOCATION;
import static io.micronaut.http.HttpStatus.NO_CONTENT;

@ExecuteOn(TaskExecutors.IO)
@Controller("/genres")
class GenreController {

    private final GenreService genreService;

    GenreController(GenreService genreService) {
        this.genreService = genreService;
    }

    @Get("/{id}")
    public Optional<Genre> show(Long id) {
        return genreService.findById(id);
    }

    @Put("/{id}/{name}")
    public HttpResponse<?> update(long id, String name) {
        genreService.update(id, name);
        return HttpResponse
                .noContent()
                .header(LOCATION, URI.create("/genres/" + id).getPath());
    }

    @Get("/list")
    public List<Genre> list(@Valid Pageable pageable) {
        return genreService.list(pageable);
    }

    @Post
    public HttpResponse<Genre> save(@Body("name") @NotBlank String name) {
        Genre genre = genreService.save(name);

        return HttpResponse
                .created(genre)
                .headers(headers -> headers.location(URI.create("/genres/" + genre.getId())));
    }

    @Delete("/{id}")
    @Status(NO_CONTENT)
    public void delete(Long id) {
        genreService.delete(id);
    }
}
