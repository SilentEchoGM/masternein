<script lang="ts">
  import { colours, isEqualRack } from "$lib/game";
  import { GAME } from "$lib/machine.svelte";
  import RackUi from "$lib/RackUi.svelte";
  import { Array, Equal, Option, pipe, Record } from "effect";
  import { isSome, orElse } from "effect/Option";

  const log = (...args: any[]) => {
    pipe(
      args,
      Array.map((arg) => JSON.stringify(arg)),
      console.log
    );
  };

  let input = $state("");

  let attempted = $derived(
    pipe(
      GAME.context.attempts,
      Array.map(({ rack }) => rack),
      Array.findFirst(isEqualRack(GAME.context.rack)),
      Option.isSome
    )
  );

  $effect(() => {
    log(
      "aa",
      GAME.snapshot.value,
      GAME.context.room,
      ...GAME.context.attempts,
      attempted
    );
  });
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
        <h3 class="text-xl font-bold">Code</h3>
        <RackUi rack="{GAME.context.code.value}" />
      </div>
    {/if}
  {/if}

  {#if GAME.snapshot.matches("player")}
    <h2 class="text-2xl font-bold">
      Playing - <button
        onclick="{() => {
          window.navigator.clipboard.writeText(
            //'http://' + window.location.host + '/room/' +
            room
          );
        }}">{room}</button>
    </h2>
  {/if}

  <RackUi
    rack="{GAME.context.rack}"
    editable="{GAME.snapshot.matches({ player: 'active' }) ||
      GAME.snapshot.matches({ host: 'active' })}" />

  {#if GAME.snapshot.matches("host") && Option.isNone(GAME.context.code)}
    <button
      onclick="{() => {
        GAME.send({
          type: 'set_code',
        });
      }}">
      Set Code
    </button>
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
      <h3 class="text-xl font-bold text-center">Failed</h3>
    </div>
  {/if}

  {#if GAME.snapshot.matches({ player: { ended: "success" } })}
    <div class="bg-green-200 p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">Success</h3>
    </div>
  {/if}

  {#each Array.reverse(GAME.context.attempts) as attempt}
    <div
      class="{isEqualRack(attempt.rack)(GAME.context.rack)
        ? 'bg-orange-200'
        : 'bg-gray-300'} p-3 rounded-lg">
      <h3 class="text-xl font-bold text-center">
        Attempt {attempt.i + 1} / {GAME.context.limit}
      </h3>

      <div class="flex gap-1">
        <RackUi rack="{attempt.rack}" />

        <div class="grid grid-rows-2 font-mono font-bold">
          <div class="">✔️❌ <span class="text-xl">{attempt.single}</span></div>
          <div>✔️✔️ <span class="text-xl">{attempt.double}</span></div>
        </div>
      </div>
    </div>
  {/each}
{/if}
