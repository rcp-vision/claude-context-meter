# Context meter for Claude Code

A Claude Code plugin that shows how full the session's context window is, at
all times, in the prompt footer:

```
▰▰▱▱▱▱▱▱▱▱ 16%
```

- Filled segments are blue up to 50%. Above 50% they shift through yellow and
  orange to red at 100%.
- The percentage takes the color of the current level, and turns bold above
  50%.
- The percentage is always written out, so the meter does not rely on color
  alone.
- In the desktop app the meter has at most 24 characters, and less in a
  narrow window. As the window narrows, the bar gives up segments so that the
  percentage stays visible.

The meter works in the Code tab of the Claude desktop app and in the terminal.
In the desktop app it appears under the model name.

## Requirements

Claude Code 2.1.295 or later. To check your version, run:

```bash
claude --version
```

If your version is older, run `claude update`.

## Install

In a terminal session of Claude Code, run:

```
/plugin install context-meter --marketplace rcp-vision/claude-context-meter
```

Answer `y` to add the marketplace, then press Enter to install for your user.

You can also install from a shell:

```bash
claude plugin marketplace add rcp-vision/claude-context-meter
claude plugin install context-meter@rcp-vision --scope user
```

Sessions started after the install load the plugin. Restart the sessions that
are already open.

## Behavior

The meter reads the context fill that the model reports with each response.
It appears after the first response of a session. A session that you resume or
that was just compacted shows the meter again after its next response.

## Update

```bash
claude plugin marketplace update rcp-vision
claude plugin update context-meter@rcp-vision
```

## Uninstall

```bash
claude plugin uninstall context-meter@rcp-vision
```

## License

[MIT](LICENSE)
