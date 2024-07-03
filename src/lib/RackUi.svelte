<script lang="ts">
  import { colours } from "./game";
  import { GAME } from "./machine.svelte";
  import type { Rack } from "./types";

  let {
    rack,
    editable = false,
    highlightAgainstPendingRack = false,
  }: {
    highlightAgainstPendingRack?: boolean;
    rack: Rack;
    editable?: boolean;
  } = $props();

  const wheelAction = (node: HTMLElement, { i }: { i: number }) => {
    node.addEventListener(
      "wheel",
      (e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.deltaY > 0) {
          GAME.send({
            type: "inc_rack",
            params: {
              i,
            },
          });
        }

        if (e.deltaY < 0) {
          GAME.send({
            type: "dec_rack",
            params: {
              i,
            },
          });
        }
      },
      { passive: false }
    );
  };
</script>

<div class="flex gap-2 px-4">
  {#each rack as colour, i}
    <div
      class="grid gap-2"
      use:wheelAction="{{
        i,
      }}">
      {#if editable}
        <button
          onclick="{() => {
            GAME.send({
              type: 'inc_rack',
              params: {
                i,
              },
            });
          }}">▲</button>
      {/if}
      <div
        class="wheel-target size-8 rounded-full border-opacity-70 border-solid border-black border-2 {highlightAgainstPendingRack &&
        GAME.context.rack[i] === colour
          ? 'border-black border-double border-8 border-opacity-70'
          : ''}"
        style:background-color="{colours[colour]}">
      </div>

      {#if editable}
        <button
          onclick="{() => {
            GAME.send({
              type: 'dec_rack',
              params: {
                i,
              },
            });
          }}">▼</button>
      {/if}
    </div>
  {/each}
</div>
