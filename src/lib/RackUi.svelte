<script lang="ts">
  import { colours } from "./game";
  import { GAME } from "./machine.svelte";
  import type { Rack } from "./types";

  let { rack, editable = false }: { rack: Rack; editable?: boolean } = $props();
</script>

<div class="flex gap-2 p-4">
  {#each rack as colour, i}
    <div class="grid gap-2">
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
        onwheel="{(e) => {
          if (!editable) return;
          e.preventDefault();

          if (e.deltaY > 0) {
            GAME.send({
              type: 'inc_rack',
              params: {
                i,
              },
            });
          }

          if (e.deltaY < 0) {
            GAME.send({
              type: 'dec_rack',
              params: {
                i,
              },
            });
          }
        }}"
        class="size-8 rounded-full border-2 border-opacity-70 border-solid border-black"
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
