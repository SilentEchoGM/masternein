<script lang="ts">
  import { colours, ColourSchema, isEqualRack, randomRack } from "$lib/game";
  import { GAME } from "$lib/machine.svelte";
  import RackUi from "$lib/RackUi.svelte";
  import { Array, Option, pipe } from "effect";

  let input = $state("");

  let attempted = $derived(
    pipe(
      GAME.context.attempts,
      Array.map(({ rack }) => rack),
      Array.findFirst(isEqualRack(GAME.context.rack)),
      Option.isSome
    )
  );
</script>

<h1 class="text-3xl font-bold">MasterNein</h1>

{#if GAME.snapshot.matches("menu")}
  <div
    style:grid-template-rows="repeat(4, auto)"
    class="grid grid-cols-1 w-32 gap-4 place-content-center p-2 place-items-center">
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      onclick="{() => {
        GAME.send({
          type: 'host',
          params: {
            roomCode: pipe(
              GAME.context.room,
              Option.getOrElse(() => '')
            ),
          },
        });
      }}">
      Host
    </button>
    <div class="bg-blue-400 h-1 w-4/5 rounded-full"></div>
    <input
      placeholder="Room code"
      bind:value="{input}"
      class="w-full bg-opacity-20 bg-black rounded text-center" />
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      onclick="{() => {
        if (input.length === 0) {
          alert('Please enter a room code');
          return;
        }

        GAME.send({
          type: 'join',
          params: {
            roomCode: input.trim(),
          },
        });
      }}">
      Join
    </button>
  </div>
{/if}

{#if Option.isSome(GAME.context.room)}
  {@const room = GAME.context.room.value}

  {#if GAME.snapshot.matches("host")}
    <h2 class="text-2xl font-bold">
      Hosting - <button
        onclick="{() => {
          window.navigator.clipboard.writeText(
            //'http://' + window.location.host + '/room/' +
            room
          );
        }}">{room}</button>
    </h2>

    {#if Option.isSome(GAME.context.code)}
      <div class="bg-gray-300 p-3 rounded-lg">
        <h3 class="text-xl font-bold text-center pb-2">Target Code</h3>
        <RackUi rack="{GAME.context.code.value}" />
      </div>
    {/if}
  {/if}

  {#if GAME.snapshot.matches("player")}
    <h2 class="text-2xl font-bold">
      {GAME.snapshot.matches({ player: "active" })
        ? "Cracking the Code"
        : "Waiting for Host"} -
      <button
        onclick="{() => {
          window.navigator.clipboard.writeText(
            //'http://' + window.location.host + '/room/' +
            room
          );
        }}">{room}</button>
    </h2>
  {/if}
  <div class="flex flex-col gap-2 bg-gray-300 p-3 rounded-lg">
    <h3 class="text-xl font-bold text-center pb-2">Possible Colours</h3>

    <div class="flex place-content-center gap-2 bg-gray-300 rounded-lg">
      {#each ColourSchema.literals as colour}
        <button
          disabled="{!GAME.snapshot.matches({ player: 'active' })}"
          class="size-8 rounded-full border-opacity-70 border-solid border-black border-2"
          style:background-color="{colours[colour]}"
          style:filter="{!GAME.context.colours.includes(colour)
            ? "grayscale(0.4)"
            : ""}"
          onclick="{() => {
            GAME.send({
              type: 'toggle_colour',
              params: {
                colour,
              },
            });
          }}">
          {#if !GAME.context.colours.includes(colour)}
            <div
              style:filter=""
              class="font-mono font-bold text-4xl -top-2 relative {colour ===
              'black'
                ? 'text-white'
                : ''}">
              x
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <RackUi
    rack="{GAME.context.rack}"
    editable="{GAME.snapshot.matches({ player: 'active' }) ||
      GAME.snapshot.matches({ host: 'active' })}" />

  {#if GAME.snapshot.matches("host") && Option.isNone(GAME.context.code)}
    <div class="flex gap-2">
      <button
        class="bg-orange-400 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        onclick="{() => {
          GAME.send({
            type: 'replace_rack',
            params: {
              rack: randomRack(),
            },
          });
        }}">Random</button>
      <button
        class="bg-green-600 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        onclick="{() => {
          GAME.send({
            type: 'set_code',
          });
        }}">
        Set Code
      </button>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ player: "active" })}
    <button
      disabled="{attempted}"
      class="bg-green-600 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
      onclick="{() => {
        GAME.send({
          type: 'attempt',
          params: {
            rack: GAME.context.rack,
          },
        });
      }}">
      Confirm
    </button>
  {/if}

  {#if GAME.snapshot.matches({ player: { ended: "failure" } })}
    <div class="bg-red-200 p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">Failed to Crack the Code!</h3>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ player: { ended: "success" } })}
    <div class="bg-green-200 p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">Code Cracked!</h3>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ host: { ended: "failure" } })}
    <div class="bg-red-200 p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">Failed to Crack the Code!</h3>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ host: { ended: "success" } })}
    <div class="bg-green-200 p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">Code Cracked!</h3>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ host: "ended" })}
    <button
      class="bg-green-600 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
      onclick="{() => {
        GAME.send({
          type: 'new_game',
        });
      }}">
      Start New Game
    </button>
  {/if}

  {#each Array.reverse(GAME.context.attempts) as attempt}
    <button
      onclick="{() => {
        GAME.send({
          type: 'replace_rack',
          params: {
            rack: attempt.rack,
          },
        });
      }}"
      class="{isEqualRack(attempt.rack)(GAME.context.rack)
        ? 'bg-orange-200'
        : 'bg-gray-300'} p-1 px-3 rounded-lg">
      <div class="flex gap-1 place-content-center place-items-center">
        <h3 class="text-xl font-bold text-center">
          {attempt.i + 1} / {GAME.context.limit}
        </h3>
        <RackUi rack="{attempt.rack}" highlightAgainstPendingRack />

        <div class="grid grid-rows-2 font-mono font-bold">
          <div class="">✔️❌ <span class="text-xl">{attempt.single}</span></div>
          <div>✔️✔️ <span class="text-xl">{attempt.double}</span></div>
        </div>
      </div>
    </button>
  {/each}
{/if}

{#if GAME.snapshot.matches("host")}
  <div class="flex flex-col">
    <h3 class="text-xl font-bold text-center">Players</h3>
    <div class="flex flex-col gap-2 bg-gray-300 p-3 rounded-lg">
      {#each GAME.context.playerList.filter((p) => !p.host) as player}
        <div
          class="flex place-content-center gap-2 bg-gray-300 rounded-lg place-items-baseline">
          <div class="font-bold">{player.displayName}</div>
          <button
            class="bg-green-600 hover:bg-green-800 disabled:bg-gray-400 font-bold text-white py-1 px-2 rounded"
            onclick="{() => {
              GAME.send({
                type: 'make_player_host',
                params: {
                  player,
                },
              });
            }}">
            Make Host
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<div
  class="grid grid-cols-2 gap-2 place-content-center place-items-center mt-auto mb-2 bg-gray-300 py-3 px-2 rounded-lg">
  <div class="font-bold">Display Name</div>

  <input class="w-full rounded text-center" bind:value="{GAME.displayName}" />
</div>
