import { program } from 'commander';
import { runDev } from './dev';
import { build, buildLibrary } from './build';

program
  .command('dev')
  .description('Develop yout plugins with Modern.TiddlyDev')
  .action(async () => {
    await runDev();
  });
program
  .command('build')
  .description('Build plugins for Modern.TiddlyDev')
  .option('--library', 'whether to build plugin library files', false)
  .action(async ({ library }: { library: boolean }) => {
    if (library) {
      await buildLibrary();
    } else {
      await build();
    }
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
program.parse();
