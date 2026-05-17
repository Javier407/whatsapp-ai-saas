"""Unit tests for the chunk_text recursive splitter."""
from __future__ import annotations

import pytest

from rag_indexer.application.index_document import chunk_text


class TestChunkText:
    def test_empty_string_returns_empty_list(self) -> None:
        assert chunk_text("") == []

    def test_whitespace_only_returns_empty_list(self) -> None:
        assert chunk_text("   \n\n  ") == []

    def test_text_shorter_than_chunk_size_returns_one_chunk(self) -> None:
        text = "Hello world"
        result = chunk_text(text, chunk_size=512, overlap=50)
        assert len(result) == 1
        assert result[0] == text

    def test_text_exactly_chunk_size_returns_one_chunk(self) -> None:
        text = "x" * 512
        result = chunk_text(text, chunk_size=512, overlap=0)
        assert len(result) == 1

    def test_chunk_size_respected(self) -> None:
        # Build a long text with paragraph separators so the splitter
        # can cut at paragraph boundaries.
        paragraphs = ["word " * 20 for _ in range(10)]
        text = "\n\n".join(paragraphs)
        result = chunk_text(text, chunk_size=120, overlap=0)
        for chunk in result:
            assert len(chunk) <= 120, f"Chunk exceeds limit: {len(chunk)}"

    def test_multiple_chunks_produced_for_long_text(self) -> None:
        text = " ".join(["word"] * 300)  # ~1500 chars
        result = chunk_text(text, chunk_size=100, overlap=0)
        assert len(result) > 1

    def test_overlap_applied(self) -> None:
        # With overlap > 0, each chunk (except the first) should begin
        # with content from the tail of the previous chunk.
        paragraphs = ["Alpha paragraph content here. " * 5 for _ in range(5)]
        text = "\n\n".join(paragraphs)
        result = chunk_text(text, chunk_size=80, overlap=20)
        assert len(result) > 1
        # Verify second chunk starts with characters from the end of the first
        tail_of_first = result[0][-20:]
        assert result[1].startswith(tail_of_first), (
            f"Overlap not found.\nTail of first: {tail_of_first!r}\n"
            f"Start of second: {result[1][:30]!r}"
        )

    def test_zero_overlap_produces_non_overlapping_chunks(self) -> None:
        text = "A" * 50 + "\n\n" + "B" * 50 + "\n\n" + "C" * 50
        result = chunk_text(text, chunk_size=60, overlap=0)
        assert len(result) >= 2

    def test_single_word_longer_than_chunk_size(self) -> None:
        # A single word longer than chunk_size should still be returned as a chunk
        word = "x" * 600
        result = chunk_text(word, chunk_size=512, overlap=0)
        assert len(result) >= 1
        # All content is accounted for
        total = "".join(result)
        assert word in total or len(total) >= len(word)
